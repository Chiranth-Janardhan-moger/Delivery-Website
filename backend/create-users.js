// Script to create default users in MongoDB
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('./models/User');
    const DeliveryBoy = require('./models/DeliveryBoy');

    // Create Admin
    console.log('\n📝 Creating Admin...');
    const adminExists = await User.findOne({ phone: '9999999999' });
    
    if (adminExists) {
      console.log('⚠️  Admin already exists');
    } else {
      const adminPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        name: 'Admin User',
        email: 'admin@dsk.com',
        phone: '9999999999',
        password: adminPassword,
        role: 'admin',
        status: 'active',
      });
      console.log('✅ Admin created: phone=9999999999, password=admin123');
    }

    // Create Delivery Boy
    console.log('\n📝 Creating Delivery Boy...');
    const driverExists = await User.findOne({ phone: '8888888888' });
    
    if (driverExists) {
      console.log('⚠️  Delivery boy already exists');
    } else {
      const driverPassword = await bcrypt.hash('driver123', 10);
      const driverUser = await User.create({
        name: 'John Driver',
        email: 'driver@dsk.com',
        phone: '8888888888',
        password: driverPassword,
        role: 'driver',
        status: 'active',
      });

      await DeliveryBoy.create({
        userId: driverUser._id,
        name: 'John Driver',
        phone: '8888888888',
        status: 'active',
        totalDeliveries: 0,
        completedDeliveries: 0,
        averageRating: 0,
      });
      
      console.log('✅ Delivery boy created: phone=8888888888, password=driver123');
    }

    console.log('\n✨ All users created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Admin - Phone: 9999999999, Password: admin123');
    console.log('   Driver - Phone: 8888888888, Password: driver123');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createUsers();
