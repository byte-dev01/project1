exports.allAccess = (req, res) => {
  res.status(200).send("Public Content.");
};

exports.userBoard = (req, res) => {
  res.status(200).send("User Content.");
};

exports.adminBoard = (req, res) => {
  res.status(200).send("Admin Content.");
};

exports.moderatorBoard = (req, res) => {
  res.status(200).send("Moderator Content.");
};
exports.doctorBoard = (req, res) => {
  res.status(200).send("Doctor Content.");
};

exports.staffBoard = (req, res) => {
  res.status(200).send("Staff Content.");
};