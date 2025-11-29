const cron = require('node-cron');
const Order = require('../models/Order');

// Function to delete delivery history older than 1 day
const cleanupDeliveryHistory = async () => {
  try {
    console.log('🧹 Starting delivery history cleanup...');
    
    // Calculate cutoff time (1 day ago)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    // Delete completed orders older than 1 day
    const result = await Order.deleteMany({
      status: 'delivered',
      deliveredAt: { $lt: oneDayAgo }
    });
    
    console.log(`✅ Cleanup completed: ${result.deletedCount} old delivery records deleted`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

// Schedule cleanup to run daily at 1:00 AM
const scheduleCleanup = () => {
  // Cron expression: minute hour day month dayOfWeek
  // '0 1 * * *' means: at 1:00 AM every day
  cron.schedule('0 1 * * *', cleanupDeliveryHistory, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });
  
  console.log('📅 Delivery history cleanup scheduled for 1:00 AM daily');
};

// Manual cleanup function for testing
const runCleanupNow = async () => {
  await cleanupDeliveryHistory();
};

module.exports = {
  scheduleCleanup,
  runCleanupNow,
  cleanupDeliveryHistory
};