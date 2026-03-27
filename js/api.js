const API_ENDPOINT = 'https://script.google.com/macros/s/YOUR_GAS_ID/exec'; // Replace with actual GAS URL

const api = {
  async get(params = {}) {
    const url = new URL(API_ENDPOINT);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json();
    } catch (error) {
      console.error('API GET error:', error);
      throw error;
    }
  },

  async post(data) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors', // Common for GAS
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response;
    } catch (error) {
      console.error('API POST error:', error);
      throw error;
    }
  },

  /**
   * Fetch patient history from Google Sheets
   * @param {string} id - Patient ID
   */
  async getPatientData(id) {
    // return this.get({ action: 'getPatientData', patientId: id });
    
    // Simulation for demo
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: id,
          history: [
            { date: '2026-03-20', rom: 65, grip: 40, adherence: 80 },
            { date: '2026-03-22', rom: 68, grip: 42, adherence: 90 },
            { date: '2026-03-24', rom: 72, grip: 45, adherence: 85 },
            { date: '2026-03-26', rom: 75, grip: 48, adherence: 95 }
          ]
        });
      }, 500);
    });
  },

  /**
   * Upload session data to backend
   * @param {Object} data - { patientId, task, angle, reps, adherence }
   */
  async uploadSession(data) {
    console.log('Uploading session data:', data);
    // return this.post({ action: 'uploadSession', ...data });
    
    // Simulation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, timestamp: new Date().toISOString() });
      }, 800);
    });
  }
};

window.healscapeApi = api;
