require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const cors = require('cors');
const axios = require('axios');

const PORT = process.env.PORT || 3000;

//URLs for microservices
const PREFERENCES_SERVICE_URL = process.env.PREFERENCES_SERVICE_URL;
const FAVORITES_SERVICE_URL = process.env.FAVORITES_SERVICE_URL;
const CAT_DATABASE_URL = process.env.CAT_DATABASE_URL;

app.use(cors());
app.use(express.json());

async function fetchUserPreferences(userID) {
  const response = await axios.get(
    `${PREFERENCES_SERVICE_URL}/api/preferences/${userID}`
  );
  return response;
}

function buildQueryParams(preferences) {
  console.log('Preferences:', preferences);
  let query = {};

  if (preferences.location) {
    query.lat = preferences.location.latitude;
    query.lon = preferences.location.longitude;
    query.radius = preferences.radius || 50; // in miles
  }

  if (preferences.strict) {
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
  }

  return query;
}

function scoreCat(cat, preferences) {
  let matchCount = 0;
  if (preferences.color && cat.color === preferences.color) {
    matchCount++;
  }
  if (preferences.sex && cat.sex === preferences.sex) {
    matchCount++;
  }
  if (preferences.breed && cat.breed === preferences.breed) {
    matchCount++;
  }
  if (preferences.minAge && cat.age >= preferences.minAge) {
    matchCount++;
  }
  if (preferences.maxAge && cat.age <= preferences.maxAge) {
    matchCount++;
  }
  return matchCount;
}

async function fetchCats(query) {
  try {
    const response = await axios.get(`${CAT_DATABASE_URL}/api/cats`, {
      params: { ...query },
    });
    // console.log('Cats:', response.data.cats);
    return response.data.cats || [];
  } catch (error) {
    console.error('Error fetching cats:', error.data);
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
    const preferencesResponse = await fetchUserPreferences(userID);
    const preferences = preferencesResponse.data;
    const strictMode = preferences.strict;

    // fetch favorites
    const favoritesResponse = await axios.get(
      `${FAVORITES_SERVICE_URL}/api/favorites/${userID}`
    );
    const favorites = favoritesResponse.data.favorites || [];
    

    // build query params
    let query = buildQueryParams(preferences);

    // fetch cats
    const cats = await fetchCats(query);

    // filter out favorites
    const filteredCats = cats.filter((cat) => {
      return !favorites.includes(cat._id);
    });

    let recommendedCats;

    if (strictMode) {
      recommendedCats = filteredCats;
    } else {
      recommendedCats = filteredCats
        .map((cat) => {
          return { ...cat, catScore: scoreCat(cat, preferences) };
        })
        .sort((a, b) => {
          return b.catScore - a.catScore;
        });
    }

    console.log('Scored Cats:', recommendedCats);
    // return cats
    res.json({ recommendedCats: recommendedCats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error getting recommendations' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
