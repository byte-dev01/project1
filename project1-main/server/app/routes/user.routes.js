const { authJwt } = require("../middleware");
const controller = require("../controllers/user.controller");

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/test/all", controller.allAccess);

  app.get(
    "/api/test/user",
    [authJwt.verifyToken],
    controller.userBoard
  );

  app.get(
    "/api/test/moderator",
    [authJwt.verifyToken, authJwt.isModerator],
    controller.moderatorBoard
  );
    app.get(
    "/api/test/doctor",
    [authJwt.verifyToken, authJwt.isDoctor],
    controller.doctorBoard
  );
    app.get(
    "/api/test/staff",
    [authJwt.verifyToken, authJwt.isStaff],
    controller.staffBoard
  );

  app.get(
    "/api/test/admin",
    [authJwt.verifyToken, authJwt.isAdmin],
    controller.adminBoard
  );
};
