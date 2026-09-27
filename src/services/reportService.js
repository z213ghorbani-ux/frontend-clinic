import api from "./api";

const reportService = {
  async getReports(params = {}) {
    const response = await api.get("/reports", {
      params,
    });
    return response.data;
  },

  async batchDeleteReports(fromDateOrObject, maybeToDate) {
    const payload =
      typeof fromDateOrObject === "object" && fromDateOrObject !== null
        ? {
            from_date:
              fromDateOrObject.from_date ?? fromDateOrObject.fromDate ?? "",
            to_date: fromDateOrObject.to_date ?? fromDateOrObject.toDate ?? "",
          }
        : {
            from_date: fromDateOrObject,
            to_date: maybeToDate,
          };

    // نکته: روت بک‌اند (api/reports/batch-delete) فقط متد POST را
    // پشتیبانی می‌کند. با axios.delete درخواست 405 (Method Not Allowed)
    // برمی‌گشت، چون سرور DELETE را برای این آدرس ثبت نکرده است.
    const response = await api.post("/reports/batch-delete", payload);

    return response.data;
  },
};

export default reportService;
