const express = require('express');
const router = express.Router();
const DeliveryBoy = require('../models/DeliveryBoy');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { broadcast } = require('../websocket/websocket');

// All driver routes require authentication and driver role
router.use(authenticate);
router.use(authorize('driver'));

// GET /api/driver/orders
router.get('/orders', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const driverId = req.user.userId;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const query = { 'assignedDeliveryBoy.id': deliveryBoy._id };
    if (status) query.deliveryStatus = status;

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
    console.error('Get driver orders error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get orders',
      code: 'GET_ORDERS_ERROR'
    });
  }
});

// GET /api/driver/orders/:orderId
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const driverId = req.user.userId;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const order = await Order.findOne({
      orderId,
      'assignedDeliveryBoy.id': deliveryBoy._id
    });

    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    res.json(order);
  } catch (error) {
    console.error('Get driver order error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get order',
      code: 'GET_ORDER_ERROR'
    });
  }
});

// POST /api/driver/orders/:orderId/confirm
router.post('/orders/:orderId/confirm', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { latitude, longitude, photo, notes } = req.body;
    const driverId = req.user.userId;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const order = await Order.findOne({
      orderId,
      'assignedDeliveryBoy.id': deliveryBoy._id
    });

    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    // Update order
    order.deliveryStatus = 'Delivered';
    order.paymentStatus = 'Completed';
    order.deliveredAt = new Date();
    order.deliveredBy = deliveryBoy.name;
    order.deliveryLocation = { latitude, longitude };
    if (photo) order.deliveryPhoto = photo;
    if (notes) order.deliveryNotes = notes;

    await order.save();

    // Update delivery boy stats
    deliveryBoy.completedDeliveries += 1;
    deliveryBoy.totalDeliveries += 1;
    await deliveryBoy.save();

    // Create transaction
    await Transaction.create({
      orderId: order.orderId,
      amount: order.totalAmount,
      paymentMode: order.paymentMode,
      paymentStatus: order.paymentStatus,
      driverId: deliveryBoy._id.toString(),
      customerId: order.customerName,
    });

    // Broadcast to admin via WebSocket
    broadcast({
      type: 'ORDER_DELIVERED',
      order: {
        orderId: order.orderId,
        deliveryStatus: order.deliveryStatus,
        paymentStatus: order.paymentStatus,
        deliveredAt: order.deliveredAt,
        deliveredBy: order.deliveredBy,
        latitude,
        longitude
      }
    });

    res.json({
      message: 'Delivery confirmed successfully',
      orderId: order.orderId,
      deliveryStatus: order.deliveryStatus,
      paymentStatus: order.paymentStatus,
      deliveredAt: order.deliveredAt
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to confirm delivery',
      code: 'CONFIRM_DELIVERY_ERROR'
    });
  }
});

// POST /api/driver/orders/:orderId/validate-scan
router.post('/orders/:orderId/validate-scan', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { packageCode } = req.body;

    if (!packageCode) {
      return res.status(400).json({
        error: true,
        message: 'Package code is required',
        code: 'MISSING_PACKAGE_CODE'
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    const isValid = packageCode.startsWith('PKG');

    res.json({
      valid: isValid,
      message: isValid ? 'Package verified' : 'Invalid package code'
    });
  } catch (error) {
    console.error('Validate scan error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to validate package',
      code: 'VALIDATE_SCAN_ERROR'
    });
  }
});

// GET /api/driver/history
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const driverId = req.user.userId;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const query = {
      'assignedDeliveryBoy.id': deliveryBoy._id,
      deliveryStatus: 'Delivered'
    };

    if (startDate || endDate) {
      query.deliveredAt = {};
      if (startDate) query.deliveredAt.$gte = new Date(startDate);
      if (endDate) query.deliveredAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ deliveredAt: -1 });
    
    const total = await Order.countDocuments(query);

    res.json({
      orders,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get history',
      code: 'GET_HISTORY_ERROR'
    });
  }
});

// GET /api/driver/profile
router.get('/profile', async (req, res) => {
  try {
    const driverId = req.user.userId;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    res.json(deliveryBoy);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to get profile',
      code: 'GET_PROFILE_ERROR'
    });
  }
});

// PUT /api/driver/profile
router.put('/profile', async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { name, phone, email } = req.body;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: driverId });
    if (!deliveryBoy) {
      return res.status(404).json({
        error: true,
        message: 'Delivery boy profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const User = require('../models/User');
    const user = await User.findById(driverId);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (name) {
      deliveryBoy.name = name;
      user.name = name;
    }
    if (phone) {
      deliveryBoy.phone = phone;
      user.phone = phone;
    }
    if (email) {
      user.email = email;
    }

    await deliveryBoy.save();
    await user.save();

    res.json(deliveryBoy);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to update profile',
      code: 'UPDATE_PROFILE_ERROR'
    });
  }
});

module.exports = router;
