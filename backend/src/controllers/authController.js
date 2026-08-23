const registerUser = async (req, res) => {
    try {
      console.log("Registration data:", req.body);
  
      res.status(201).json({
        message: "Registration request received",
        data: req.body
      });
  
    } catch (error) {
      console.error(error);
  
      res.status(500).json({
        message: "Server error"
      });
    }
  };
  
  module.exports = {
    registerUser
  };