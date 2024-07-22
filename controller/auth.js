//{ loginEmail: 'w@w', loginPassword: '1213131' }

export const checkUser = (req, res) => {
  if (req.user) {
    console.log('Logged in user ->', req.user);
    res.status(200).json({
      message: "Logged in successfully",
      user: req.user
    });
  } else {
    res.status(401).json({ error: "User not authenticated" });
  }
}

export const checkAuthenticated = (req, res) => {
  console.log("checkAuth->", req.user);
  res.json({ authenticated: true, user: req.user.name });
}

export const logoutUser = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).json({ message: "Error logging out" });
    }
    console.log("logged out successfully.");
    return res.status(200).json({ message: "Logout successful" });
  });
}
