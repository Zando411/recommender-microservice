require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const cors = require('cors');
const axios = require('axios');

const PORT = process.env.PORT || 3000;

//URLs for microservices
const PREFERENCES_SERVICE_URL = process.env.PREFERENCES_SERVICE_URL;
const CAT_DATABASE_URL = process.env.CAT_DATABASE_URL;

app.use(cors());
app.use(express.json());

async function fetchUserPreferences(userID) {
  const response = await axios.get(
    `${PREFERENCES_SERVICE_URL}/api/preferences/${userID}`
  );
  return response.data;
}

function buildQueryParams(passedPreferences) {
  let preferences = passedPreferences.data;
  console.log('Preferences:', preferences);
  let query = {};
  if (preferences.location && preferences.radius) {
    query.lat = preferences.location.latitude;
    query.lon = preferences.location.longitude;
    query.radius = preferences.radius; // in miles
  }

  if (preferences.color != null) {
    query.color = preferences.color;
  }
  if (preferences.age) {
    query.minAge = preferences.age.minAge;
    query.maxAge = preferences.age.maxAge;
  }
  if (preferences.sex) {
    query.sex = preferences.sex;
  }
  if (preferences.breed) {
    query.breed = preferences.breed;
  }

  return query;
}

async function fetchCats(preferences) {
  try {
    const query = buildQueryParams(preferences);
    console.log('Query:', query);
    const response = await axios.get(`${CAT_DATABASE_URL}/api/cats`, {
      params: query,
    });
    console.log('Cats:', response);
    return response.data.cats;
  } catch (error) {
    console.error('Error fetching cats:', error);
    return [];
  }
}

app.get('/api/recommend', async (req, res) => {
  const { userID } = req.query;

  if (!userID) {
    return res.status(400).json({ error: 'Missing userID' });
  }

  try {
    // fetch preferences
    const preferences = await fetchUserPreferences(userID);

    // initial cat database API call
    let cats = await fetchCats(preferences);

    // if too few cats meet params
    if (cats.length < 2) {
      let query = {};
      query.lat = preferences.location.latitude;
      query.lon = preferences.location.longitude;
      query.radius = preferences.radius;
      cats = (await axios.get(CAT_DATABASE_URL, { params: query })).data.cats;
    }

    const topCats = cats.slice(0, 5);
    // return cats
    res.json(topCats);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error getting recommendations' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
