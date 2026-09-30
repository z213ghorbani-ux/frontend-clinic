import axios from "axios";

// برای استقرار روی سرور Coolify:
const BACKEND_URL =
  "http://muganyvxuibi0woi6a0xqxs8.31.171.100.244.sslip.io/api";

// برای توسعه لوکال در سیستم خودت (در صورت نیاز آن‌کامنت کن):
// const BACKEND_URL = "http://localhost:8000/api";

const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return Promise.reject(error);
  },
);

export default api;
