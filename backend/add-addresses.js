// Script to add sample addresses to the database
// Run with: node add-addresses.js

require('dotenv').config();
const mongoose = require('mongoose');
const Address = require('./models/Address');

// Sample addresses - Add your addresses here
const sampleAddresses = [
  "Sai Nandana Grandeur Gottigere Lake Road, Bannerghatta Rd, Bengaluru, Karnataka 560083"
];

async function addAddresses() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    let added = 0;
    let skipped = 0;

    for (const address of sampleAddresses) {
      try {
        // Check if address already exists
        const existing = await Address.findOne({ address });
        if (existing) {
          console.log(`⏭️  Skipped (exists): ${address}`);
          skipped++;
        } else {
          await Address.create({ address });
          console.log(`✅ Added: ${address}`);
          added++;
        }
      } catch (err) {
        console.error(`❌ Error adding "${address}":`, err.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Added: ${added}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total in DB: ${await Address.countDocuments()}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

addAddresses();
