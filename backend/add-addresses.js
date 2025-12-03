// Script to add sample addresses to the database
// Run with: node add-addresses.js

require('dotenv').config();
const mongoose = require('mongoose');
const Address = require('./models/Address');

// Sample addresses - Add your addresses here
const sampleAddresses = [
"Sai Nandana Grandeur Gottigere Lake Road, Bannerghatta Rd, Bengaluru, Karnataka 560083",
"Sai Nandana Gardenia Gottigere Lake Rd, Balaji Gardens Layout, Gottigere, Bengaluru, Karnataka 560083",
"Prestige Song of the South, Begur Main Rd, Akshaya Vana, Akshayanagar, Bengaluru, Karnataka 560068",
"Sriven Skypark, Central Excise Layout Phase 2, 3rd Cross, Doddakammanahalli Main Rd, Tejaswini Nagar, Bengaluru, Karnataka 560083",
"Lotus Petals, Doddakammanahalli Main Rd, Central Excise Layout Phase 2, Tejaswini Nagar, Bengaluru, Karnataka 560083",
"Pranavi Pride, Sr No 6/131/4, Doddakammanahalli Main Rd, Central Excise Layout Phase 2, Tejaswini Nagar, Bengaluru, Karnataka 560083",
"Yuva Heritage, #82, 3rd Cross Rd, Central Excise Layout Phase 2, Tejaswini Nagar, Bengaluru, Karnataka 560083",
"Brahma Grandeur, DNP Layout, Doddakammanahalli Main Rd, Tejaswini Nagar, Bengaluru, Karnataka 560083",
"GSN Residency, 4th Cross, Doddakammanahalli Main Rd, Tejaswini Nagar, Bengaluru, Karnataka 560083",
"Sai Classic Apartment, Doddakammanahalli Main Rd, Tejaswini Nagar, Bengaluru, Karnataka 560083",
"Savitri Balaji Ashirvaad Elite, Pragathi Residency, Phase 2, Tejaswini Nagar, Chandrasekarapura, Bengaluru, Karnataka 560083",
"Pariwar Passion, Nobel Residency Rd, Tejaswini Nagar, Doddakammanahalli, Bengaluru, Karnataka 560076",
"Nandi Woods, Off Bannerghatta Road, Nobel Residency, Phase 2, Tejaswini Nagar, Bengaluru, Karnataka 560076",
"Nandi Meraki, Sy. No. 42/1, Kammanahalli Village, Off Bannerghatta Road, Tejaswini Nagar, Bengaluru, Karnataka 560076",
"Radiant Redwood, Sy No. 41/1, Yelenahalli, Begur Koppa Road, Akshayanagar, Bengaluru, Karnataka 560068",
"Amoda Valmark, Kammanahalli Main Rd, Ramanshree Nagar, Phase 2, Gottigere, Bengaluru, Karnataka 560083",
"GRC Sapphire Spring, Balaji Gardens Layout, Gottigere, Bannerghatta Road, Bengaluru, Karnataka 560083",
"Esteem South Park, Off Bannerghatta Road, Gottigere, Bengaluru, Karnataka 560083",
"Windsor Amulyam, Doddakammanahalli Main Rd, Kalena Agrahara, Bengaluru, Karnataka 560083",
"Serenity Gardens by SNN, Survey No 40, Begur Main Rd, Yelenahalli Village, Begur Hobli, Bengaluru, Karnataka 560068",
"Brindavan Villa, Central Excise Layout Phase 2, Tejaswini Nagar, Doddakammanahalli, Bengaluru, Karnataka 560083"
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
