const bcrypt = require("bcryptjs");
const crypto = require('crypto');

// Manual hashing function
function hashPassword(password) {
    const salt = crypto.randomBytes(128).toString('base64');
    const iterations = 10000;
    const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    return { salt, hash, iterations };
}

// Performance test
function performanceTest() {
    const password = "TestPassword123!";
    const iterations = 100;

    console.log("Testing password hashing performance...\n");

    // Test bcrypt
    console.time("bcrypt (rounds: 12)");
    for (let i = 0; i < iterations; i++) {
        bcrypt.hashSync(password, 12);
    }
    console.timeEnd("bcrypt (rounds: 12)");

    // Test manual crypto
    console.time("manual crypto (10000 iterations)");
    for (let i = 0; i < iterations; i++) {
        hashPassword(password);
    }
    console.timeEnd("manual crypto (10000 iterations)");

    // Single hash examples
    console.log("\nSingle hash examples:");
    
    const bcryptHash = bcrypt.hashSync(password, 12);
    console.log("bcrypt result:", bcryptHash);
    
    const manualHash = hashPassword(password);
    console.log("manual result:", {
        salt: manualHash.salt.substring(0, 20) + "...",
        hash: manualHash.hash.substring(0, 20) + "...",
        iterations: manualHash.iterations
    });
}

// Run the test
performanceTest();