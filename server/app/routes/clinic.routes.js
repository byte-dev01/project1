const Clinic = require("../models/clinic.model"); // 确保你有这个模型
const clinics = require("../controllers/clinic.controller");
const { authJwt } = require("../middleware");

module.exports = function(app) {
  app.get("/api/clinic/init", async (req, res) => {
    try {
      const clinicCount = await Clinic.estimatedDocumentCount();

      if (clinicCount === 0) {
        const sampleClinic = new Clinic({
          name: "Main Medical Center",
          address: {
            street: "123 Health St",
            city: "Los Angeles",
            state: "CA",
            zip: "90001"
          },
          phone: "(767) 123-4567",
          email: "info@mainmedical.com"
        });
        await sampleClinic.save();
        console.log("✅ Added sample clinic");
        return res.status(201).json({ message: "Sample clinic created." });
      } else {
        return res.status(200).json({ message: "Clinic already exists." });
      }
    } catch (err) {
      console.error("❌ Error initializing clinic:", err);
      return res.status(500).json({ message: "Server error", error: err.message });
    }


  });
  app.get("/api/clinics", clinics.findAll);
  app.get("/api/clinics/:id", clinics.findOne);
  
  // Admin only routes
  app.post("/api/clinics", 
    [authJwt.verifyToken, authJwt.isAdmin], 
    clinics.create
  );
  
  app.put("/api/clinics/:id", 
    [authJwt.verifyToken, authJwt.isAdmin], 
    clinics.update
  );


};
/*
module.exports = function(app) {
};*/