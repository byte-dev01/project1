const Clinic = require("../models/clinic.model");

exports.findAll = async (req, res) => {
  const clinics = await Clinic.find();
  res.json(clinics);
};

exports.findOne = async (req, res) => {
  const clinic = await Clinic.findById(req.params.id);
  if (!clinic) return res.status(404).json({ message: "未找到诊所" });
  res.json(clinic);
};

exports.create = async (req, res) => {
  const clinic = new Clinic(req.body);
  await clinic.save();
  res.status(201).json(clinic);
};

exports.update = async (req, res) => {
  const clinic = await Clinic.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!clinic) return res.status(404).json({ message: "未找到诊所" });
  res.json(clinic);
};
