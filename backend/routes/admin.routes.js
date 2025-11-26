const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const DeliveryBoy = require('../models/DeliveryBoy');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { generateOrderId } = require('../utils/helpers');
const { broadcastToDrivers, sendToUser } = require('../websocket/websocket');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ deliveryStatus: 'Pending' });
    const deliveredOrders = await Order.countDocuments({ deliveryStatus: 'Delivered' });
    
    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    
    const totalDeliveryBoys = await DeliveryBoy.countDocuments();

    res.json({
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalRevenue,
      totalDeliveryBoys
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get dashboard data',
      code: 'DASHBOARD_ERROR'
    });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);

    res.json({
      users,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get users',
      code: 'GET_USERS_ERROR'
    });
  }
});

// POST /api/admin/users/admin
router.post('/users/admin', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: true,
        message: 'Name and phone are required',
        code: 'MISSING_FIELDS'
      });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: 'Phone number already exists',
        code: 'PHONE_EXISTS'
      });
    }

    const defaultPassword = process.env.DEFAULT_PASSWORD || '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const newAdmin = await User.create({
      name,
      phone,
      email: `${phone}@dsk.com`,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
    });

    res.status(201).json({
      id: newAdmin._id,
      name: newAdmin.name,
      phone: newAdmin.phone,
      role: newAdmin.role,
      status: newAdmin.status,
      defaultPassword,
      message: `Admin created. Share credentials: username=${phone}, password=${defaultPassword}`
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to create admin',
      code: 'CREATE_ADMIN_ERROR'
    });
  }
});

// DELETE /api/admin/users/:userId
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // If delivery boy, remove from deliveryBoys collection
    if (user.role === 'driver') {
      await DeliveryBoy.deleteOne({ userId: user._id });
    }

    await User.findByIdAndDelete(userId);

    // Send logout notification via WebSocket
    sendToUser(userId, {
      type: 'FORCE_LOGOUT',
      message: 'Your account has been deleted'
    });

    res.json({
      message: 'User deleted successfully',
      userId,
      role: user.role,
      note: 'If delivery boy was logged in, session will be invalidated and user will be logged out automatically'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to delete user',
      code: 'DELETE_USER_ERROR'
    });
  }
});

// POST /api/admin/orders
router.post('/orders', async (req, res) => {
  try {
    const { customerName, customerPhone, items, deliveryAddress, totalAmount, paymentMode } = req.body;

    if (!customerName || !customerPhone || !items || !deliveryAddress || !totalAmount || !paymentMode) {
      return res.status(400).json({
        error: true,
        message: 'All fields are required',
        code: 'MISSING_FIELDS'
      });
    }

    const newOrder = await Order.create({
      orderId: generateOrderId(),
      customerName,
      customerPhone,
      items,
      deliveryAddress,
      totalAmount,
      paymentMode,
      paymentStatus: paymentMode === 'Paid' ? 'Completed' : 'Pending',
      deliveryStatus: 'Pending',
    });

    // Broadcast to all delivery boys via WebSocket
    broadcastToDrivers({
      type: 'ORDER_CREATED',
      order: newOrder
    });

    res.status(201).json({
      ...newOrder.toObject(),
      message: 'Order created and broadcast to all delivery boys'
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to create order',
      code: 'CREATE_ORDER_ERROR'
    });
  }
});

// GET /api/admin/orders
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus, startDate, endDate } = req.query;
    
    const query = {};
    if (status) query.deliveryStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Order.countDocuments(query);

    res.json({
      orders,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get orders',
      code: 'GET_ORDERS_ERROR'
    });
  }
});

// GET /api/admin/orders/:orderId
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get order',
      code: 'GET_ORDER_ERROR'
    });
  }
});

// PUT /api/admin/orders/:orderId/payment-status
router.put('/orders/:orderId/payment-status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus, actualPaymentMethod, notes } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    order.paymentStatus = paymentStatus;
    if (actualPaymentMethod) order.actualPaymentMethod = actualPaymentMethod;
    if (notes) order.paymentNotes = notes;
    order.paymentUpdatedAt = new Date();

    await order.save();

    res.json({
      message: 'Payment status updated successfully',
      orderId,
      paymentStatus,
      actualPaymentMethod,
      updatedAt: order.paymentUpdatedAt
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to update payment status',
      code: 'UPDATE_PAYMENT_ERROR'
    });
  }
});

// PUT /api/admin/orders/:orderId/assign
router.put('/orders/:orderId/assign', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryBoyId } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy not found',
        code: 'DELIVERY_BOY_NOT_FOUND'
      });
    }

    order.assignedDeliveryBoy = {
      id: deliveryBoy._id,
      name: deliveryBoy.name,
      phone: deliveryBoy.phone
    };
    order.assignedAt = new Date();
    order.deliveryStatus = 'Assigned';

    await order.save();

    // Send notification to assigned delivery boy
    sendToUser(deliveryBoy.userId.toString(), {
      type: 'ORDER_ASSIGNED',
      order
    });

    res.json(order);
  } catch (error) {
    console.error('Assign order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to assign order',
      code: 'ASSIGN_ORDER_ERROR'
    });
  }
});

// GET /api/admin/delivery-boys
router.get('/delivery-boys', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const deliveryBoys = await DeliveryBoy.find(query)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await DeliveryBoy.countDocuments(query);

    res.json({
      deliveryBoys,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get delivery boys error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get delivery boys',
      code: 'GET_DELIVERY_BOYS_ERROR'
    });
  }
});

// POST /api/admin/delivery-boys
router.post('/delivery-boys', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: true,
        message: 'Name and phone are required',
        code: 'MISSING_FIELDS'
      });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: 'Phone number already exists',
        code: 'PHONE_EXISTS'
      });
    }

    const defaultPassword = process.env.DEFAULT_PASSWORD || '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const newUser = await User.create({
      name,
      phone,
      email: `${phone}@dsk.com`,
      password: hashedPassword,
      role: 'driver',
      status: 'active',
    });

    const newDeliveryBoy = await DeliveryBoy.create({
      userId: newUser._id,
      name,
      phone,
      status: 'active',
      totalDeliveries: 0,
      completedDeliveries: 0,
      averageRating: 0,
    });

    res.status(201).json({
      id: newDeliveryBoy._id,
      userId: newUser._id,
      name: newDeliveryBoy.name,
      phone: newDeliveryBoy.phone,
      status: newDeliveryBoy.status,
      totalDeliveries: 0,
      completedDeliveries: 0,
      averageRating: 0,
      defaultPassword,
      message: `Delivery boy created. Share credentials with driver: username=${phone}, password=${defaultPassword}`
    });
  } catch (error) {
    console.error('Create delivery boy error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to create delivery boy',
      code: 'CREATE_DELIVERY_BOY_ERROR'
    });
  }
});

// PUT /api/admin/delivery-boys/:deliveryBoyId
router.put('/delivery-boys/:deliveryBoyId', async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    const updates = req.body;

    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      deliveryBoyId,
      updates,
      { new: true }
    );

    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy not found',
        code: 'DELIVERY_BOY_NOT_FOUND'
      });
    }

    res.json(deliveryBoy);
  } catch (error) {
    console.error('Update delivery boy error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to update delivery boy',
      code: 'UPDATE_DELIVERY_BOY_ERROR'
    });
  }
});

// DELETE /api/admin/delivery-boys/:deliveryBoyId
router.delete('/delivery-boys/:deliveryBoyId', async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy not found',
        code: 'DELIVERY_BOY_NOT_FOUND'
      });
    }

    await DeliveryBoy.findByIdAndDelete(deliveryBoyId);
    await User.findByIdAndDelete(deliveryBoy.userId);

    // Send logout notification
    sendToUser(deliveryBoy.userId.toString(), {
      type: 'FORCE_LOGOUT',
      message: 'Your account has been deleted'
    });

    res.json({
      message: 'Delivery boy deleted successfully'
    });
  } catch (error) {
    console.error('Delete delivery boy error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to delete delivery boy',
      code: 'DELETE_DELIVERY_BOY_ERROR'
    });
  }
});

// GET /api/admin/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const deliveryBoys = await DeliveryBoy.find()
      .sort({ completedDeliveries: -1 })
      .limit(10);

    const leaderboard = deliveryBoys.map((db, index) => ({
      rank: index + 1,
      deliveryBoyId: db._id,
      name: db.name,
      deliveries: db.completedDeliveries
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get leaderboard',
      code: 'GET_LEADERBOARD_ERROR'
    });
  }
});

// GET /api/admin/revenue
router.get('/revenue', async (req, res) => {
  try {
    const { period = 'today' } = req.query;

    const result = await Order.aggregate([
      { $match: { paymentStatus: 'Completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          cash: {
            $sum: {
              $cond: [{ $eq: ['$paymentMode', 'Cash'] }, '$totalAmount', 0]
            }
          },
          upi: {
            $sum: {
              $cond: [{ $eq: ['$paymentMode', 'UPI'] }, '$totalAmount', 0]
            }
          },
          card: {
            $sum: {
              $cond: [{ $eq: ['$paymentMode', 'Card'] }, '$totalAmount', 0]
            }
          }
        }
      }
    ]);

    const data = result.length > 0 ? result[0] : {
      totalRevenue: 0,
      cash: 0,
      upi: 0,
      card: 0
    };

    res.json({
      totalRevenue: data.totalRevenue,
      period,
      paymentMethods: {
        cash: data.cash,
        upi: data.upi,
        card: data.card
      },
      chartData: []
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get revenue',
      code: 'GET_REVENUE_ERROR'
    });
  }
});

// GET /api/admin/transactions
router.get('/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const transactions = await Transaction.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get transactions',
      code: 'GET_TRANSACTIONS_ERROR'
    });
  }
});

module.exports = router;
