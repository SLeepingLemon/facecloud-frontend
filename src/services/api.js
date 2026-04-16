import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

// Add token to requests
api.interceptors.request.use(
  function (config) {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = "Bearer " + token;
    }
    return config;
  },
  function (error) {
    return Promise.reject(error);
  },
);

// Handle errors
api.interceptors.response.use(
  function (response) {
    return response;
  },
  function (error) {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("name");
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);

export default api;
