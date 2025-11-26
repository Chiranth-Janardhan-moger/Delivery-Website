const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Create default admin if not exists
    await createDefaultAdmin();
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log('Falling back to in-memory mode...');
    // Don't exit, just log the error
  }
};

const createDefaultAdmin = async () => {
  try {
    const User = require('../models/User');
    const DeliveryBoy = require('../models/DeliveryBoy');
    
    // Create default admin
    const adminExists = await User.findOne({ phone: '9999999999' });
    
    if (!adminExists) {
      const defaultAdminPassword = await bcrypt.hash('admin123', 10);
      
      await User.create({
        name: 'Admin User',
        email: 'admin@dsk.com',
        phone: '9999999999',
        password: defaultAdminPassword,
        role: 'admin',
        status: 'active',
      });
      
      console.log('✅ Default admin created: phone=9999999999, password=admin123');
    }

    // Create sample delivery boy
    const driverExists = await User.findOne({ phone: '8888888888' });
    
    if (!driverExists) {
      const defaultDriverPassword = await bcrypt.hash('driver123', 10);
      
      const driverUser = await User.create({
        name: 'John Driver',
        email: 'driver@dsk.com',
        phone: '8888888888',
        password: defaultDriverPassword,
        role: 'driver',
        status: 'active',
      });

      // Create delivery boy profile
      await DeliveryBoy.create({
        userId: driverUser._id,
        name: 'John Driver',
        phone: '8888888888',
        status: 'active',
        totalDeliveries: 0,
        completedDeliveries: 0,
        averageRating: 0,
      });
      
      console.log('✅ Sample delivery boy created: phone=8888888888, password=driver123');
    }
  } catch (error) {
    console.error('Error creating default users:', error.message);
  }
};

// Set for invalidated tokens (in production, use Redis)
const invalidatedTokens = new Set();

module.exports = { connectDB, invalidatedTokens };
