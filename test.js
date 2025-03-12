require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 3014;

async function getRec(id) {
  try {
    const response = await axios.get(
      `http://localhost:${PORT}/api/recommend/?userID=${id}`
    );
    console.log('Recommendations:', response.data);
  } catch (error) {
    console.error('Error during get:', error);
  }
}

getRec('test@example.com');
