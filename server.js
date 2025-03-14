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
  return response;
}

function buildQueryParams(passedPreferences) {
  let preferences = passedPreferences.data;
  console.log('Preferences:', preferences);
  let query = {};
  if (preferences.location) {
    query.lat = preferences.location.latitude;
    query.lon = preferences.location.longitude;
    query.radius = preferences.radius || 50; // in miles
  }

  if (preferences.color != null) {
    query.color = preferences.color;
  }
  if (preferences.minAge) {
    query.minAge = preferences.minAge;
  }
  if (preferences.maxAge) {
    query.maxAge = preferences.maxAge;
  }
  if (preferences.sex) {
    query.sex = preferences.sex;
  }
  if (preferences.breed) {
    query.breed = preferences.breed;
  }

  return query;
}

function scoreCat(cat, preferences) {
  let matchCount = 0;
  if (preferences.data.color && cat.color === preferences.data.color) {
    matchCount++;
  }
  if (preferences.data.sex && cat.sex === preferences.data.sex) {
    matchCount++;
  }
  if (preferences.data.breed && cat.breed === preferences.data.breed) {
    matchCount++;
  }
  if (preferences.data.minAge && cat.age >= preferences.data.minAge) {
    matchCount++;
  }
  if (preferences.data.maxAge && cat.age <= preferences.data.maxAge) {
    matchCount++;
  }
  return matchCount;
}

async function fetchCats(query) {
  try {
    const response = await axios.get(`${CAT_DATABASE_URL}/api/cats`, {
      params: { ...query },
    });
    console.log('Cats:', response.data.cats);
    return response.data.cats;
  } catch (error) {
    console.error('Error fetching cats:', error.data);
    return [];
  }
}

app.get('/api/recommend', async (req, res) => {
  const { userID, page = 1, limit = 5 } = req.query;

  if (!userID) {
    return res.status(400).json({ error: 'Missing userID' });
  }

  try {
    // fetch preferences
    const preferences = await fetchUserPreferences(userID);
    let query = buildQueryParams(preferences);

    //track retrieved cats
    let seenCatIDs = new Set();
    let allCats = [];

    // initial cat database API call
    let exactMatches = await fetchCats(query, page, limit);

    // add cats only if they match 2 or more preferences
    exactMatches = exactMatches.filter((cat) => {
      let matchCount = scoreCat(cat, preferences);
      return matchCount >= 2;
    });

    // add cats to seenCatIDs
    exactMatches.forEach((cat) => seenCatIDs.add(cat._id));
    allCats.push(...exactMatches);

    // get partial matches
    let partialMatches = await fetchCats(query);
    partialMatches = partialMatches.filter((cat) => {
      let matchCount = scoreCat(cat, preferences);
      return matchCount === 1 && !seenCatIDs.has(cat._id);
    });

    // add partial matches to seenCatIDs
    partialMatches.forEach((cat) => seenCatIDs.add(cat._id));
    allCats.push(...partialMatches);

    // get remaining cats
    let remainingCats = await fetchCats({});
    remainingCats = remainingCats.filter((cat) => !seenCatIDs.has(cat._id));

    // add remaining cats to seenCatIDs
    allCats.push(...remainingCats);

    // return cats
    res.json({ recommendedCats: allCats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error getting recommendations' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
