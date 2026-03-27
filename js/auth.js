const auth = {
  login(email, password) {
    if (password !== '1234') return false;

    if (email === 'doctor@test.com') {
      sessionStorage.setItem('userRole', 'therapist');
      sessionStorage.setItem('userId', 'doctor01');
      sessionStorage.setItem('userEmail', email);
      window.location.href = 'therapist.html';
      return true;
    } else if (email === 'test@test.com') {
      sessionStorage.setItem('userRole', 'patient');
      sessionStorage.setItem('userId', 'patient01');
      sessionStorage.setItem('userEmail', email);
      window.location.href = 'patient.html';
      return true;
    }
    return false;
  },

  logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
  },

  checkAuth(requiredRole) {
    const role = sessionStorage.getItem('userRole');
    if (!role) {
      window.location.href = 'index.html';
    } else if (requiredRole && role !== requiredRole) {
      window.location.href = 'index.html';
    }
  }
};

window.healscapeAuth = auth;
