// Generated from docs/chatbot/knowledge/kb-v2.json — owner-approved conflict triage (2026-09-29).
// Applied once by ChatbotKbSeedService (marker CHATBOT_KB_V2_CONFLICT_TRIAGE_1).
// Items are touched only while still draft/needs_review AND still carrying the original imported text.

export interface TriageItem {
  seed_key: string;
  original: string;
  answer?: string;
}

export const KB_V2_CONFLICT_TRIAGE: {
  retire: TriageItem[];
  rewrite: TriageItem[];
  resolve: { code: string; resolution: string }[];
} = {
  "retire": [
    {
      "seed_key": "kb2.price.table.s2",
      "original": "Tham khảo theo bảng S2 (chưa duyệt):\n- Bộ túi ngủ: 30–49 bộ khoảng 350–380 nghìn; 50–300 bộ khoảng 420–450 nghìn.\n- Bộ nệm gối: 30–49 bộ khoảng 330–350 nghìn; 50–300 bộ khoảng 400–420 nghìn.\n- Bộ nệm gối mền: 30–49 bộ khoảng 310–330 nghìn; 50–300 bộ khoảng 380–400 nghìn.\n- Trên 300 bộ: chưa có."
    },
    {
      "seed_key": "kb2.price.range.retail",
      "original": "Dạ bộ trọn gồm nệm, gối và túi bảo quản có giá khoảng 290–400 nghìn tùy loại vải; bên em hỗ trợ in tên bé lên túi ạ."
    },
    {
      "seed_key": "kb2.price.range.school_set",
      "original": "Dạ bộ chăn gối nệm kèm túi, vải cotton, tham khảo: Bộ Tiêu chuẩn khoảng 350–400 nghìn/bộ, Bộ Cao cấp khoảng 420–500 nghìn/bộ, tùy số lượng và in/thêu logo ạ."
    },
    {
      "seed_key": "kb2.tax.vat",
      "original": "Dạ giá bán ra đã bao gồm thuế VAT 8% ạ."
    },
    {
      "seed_key": "kb2.product.material_claim.top_bottom",
      "original": "Dạ mặt trên tiếp xúc với bé là vải 100% cotton, không pha nilon nên không bị xù lông. Mặt dưới là vải dù chịu cọ xát với sàn, bền và dễ vệ sinh ạ."
    },
    {
      "seed_key": "kb2.policy.return.retail",
      "original": "Dạ nếu sản phẩm không vừa ý, bên em hỗ trợ đổi trả với mỗi bên chịu một chiều phí vận chuyển; nếu lỗi từ nhà sản xuất, bên em đổi trả hai chiều miễn phí ạ."
    },
    {
      "seed_key": "kb2.bundle.bag_fit.fold",
      "original": "Dạ nệm mầm non 120 × 60 cm gấp gọn bỏ vừa túi 47 × 35 cm, gọn nhẹ cho bé mang đi học ạ."
    },
    {
      "seed_key": "kb2.product.spec.size.blanket",
      "original": "Dạ chăn (mền) vải Cotton Cara 130 × 70 cm, vải Satin Hàn Quốc 130 × 90 cm ạ."
    }
  ],
  "rewrite": [
    {
      "seed_key": "kb2.product.thickness.quilted",
      "original": "Dạ nệm chần gòn thành phẩm dày khoảng 1–1,5 cm (vải Cara) và 1,5–2 cm (Satin Hàn Quốc); lớp gòn trước khi chần dày 4–5 cm, độ phồng phù hợp bé 18 tháng–5 tuổi ạ.",
      "answer": "Dạ nệm chần gòn có lớp gòn trước khi chần dày khoảng 4–5 cm; sau khi chần, độ dày thành phẩm khoảng 1–1,5 cm với vải Cara và 1,5–2 cm với vải Satin Hàn Quốc ạ. Nếu trường cần độ dày khác, em chuyển kỹ thuật tư vấn dòng phù hợp ạ."
    },
    {
      "seed_key": "kb2.product.thickness.foam",
      "original": "Dạ nệm foam 4 khúc dày khoảng 2,5–3 cm, vỏ và ruột rời ạ.",
      "answer": "Dạ nệm foam 4 khúc loại có sẵn dày khoảng 2,5–3 cm, vỏ và ruột rời để dễ vệ sinh. Nếu trường cần dày hơn (khoảng 3–5 cm), bên em nhận đặt theo yêu cầu và kỹ thuật sẽ xác nhận quy cách cụ thể ạ."
    },
    {
      "seed_key": "kb2.service.logo.embroider",
      "original": "Dạ bên em nhận thêu tên/logo lên nệm với số lượng từ 50 bộ, chi phí khoảng 10–15 nghìn/cái tùy mẫu và kích thước logo ạ.",
      "answer": "Dạ bên em nhận thêu tên/logo: thêu lên nệm áp dụng từ 50 bộ, chi phí tham khảo khoảng 10–15 nghìn/cái; thêu lên chăn tham khảo khoảng 20 nghìn/cái. Chi phí thực tế tùy vị trí, kích thước logo và số lượng, nhân viên kinh doanh sẽ báo giá chính xác ạ."
    },
    {
      "seed_key": "kb2.moq.backpack",
      "original": "Dạ bên em nhận may balo theo mẫu với số lượng từ 300 cái/mẫu ạ.",
      "answer": "Dạ bên em nhận may balo theo mẫu riêng của trường từ 300 cái/mẫu. Nếu số lượng ít, anh/chị có thể chọn các mẫu balo có sẵn, nhân viên sẽ tư vấn mẫu phù hợp ạ."
    },
    {
      "seed_key": "kb2.leadtime.standard",
      "original": "Dạ thời gian sản xuất tiêu chuẩn khoảng 20–30 ngày làm việc (không kể Chủ nhật, lễ) kể từ ngày xác nhận đơn hàng và tạm ứng; mùa cao điểm nên chốt màu vải sớm để tránh chờ nhập vải ạ.",
      "answer": "Dạ thời gian sản xuất tham khảo khoảng 20–30 ngày làm việc (không kể Chủ nhật, lễ) kể từ khi xác nhận đơn hàng và tạm ứng; mùa cao điểm nên chốt màu vải sớm. Ngày giao chính xác nhân viên kinh doanh sẽ xác nhận theo lịch sản xuất khi chốt đơn ạ."
    },
    {
      "seed_key": "kb2.leadtime.small_stock",
      "original": "Dạ với số lượng ít (khoảng 15 bộ), một số mẫu nệm gối có sẵn tùy màu, hoặc đặt may khoảng 15–20 ngày ạ.",
      "answer": "Dạ với số lượng ít, một số mẫu nệm gối có sẵn tùy màu; nếu đặt may thì tham khảo khoảng 15–20 ngày làm việc. Nhân viên sẽ kiểm tra hàng sẵn và xác nhận thời gian cụ thể ạ."
    },
    {
      "seed_key": "kb2.product.label.name",
      "original": "Dạ tem nhãn bên em đã cải tiến chỉ để trường điền tên bé (Name), bỏ phần lớp (Class) để bé dùng lâu dài khi chuyển lớp không bị sai thông tin ạ.",
      "answer": "Dạ tem nhãn phiên bản hiện tại chỉ để trường điền tên bé (Name), không ghi lớp để bé dùng lâu dài khi chuyển lớp. Trước khi sản xuất, bên em gửi mẫu tem để trường duyệt ạ."
    },
    {
      "seed_key": "kb2.shipping.retail_hcm",
      "original": "Dạ giá chưa bao gồm phí giao hàng. Bên em miễn phí giao nội thành TP.HCM khi chuyển khoản trước ạ.",
      "answer": "Dạ giá chưa bao gồm phí giao hàng. Bên em miễn phí giao nội thành TP.HCM khi chuyển khoản trước; khu vực khác nhân viên sẽ báo phí cụ thể ạ."
    },
    {
      "seed_key": "kb2.shipping.wholesale",
      "original": "Dạ bên em giao toàn quốc qua chành xe, Viettel Post hoặc đường sắt. Với đơn sỉ từ 100 bộ, ERP4U hỗ trợ khoảng 20–50% phí vận chuyển tùy khu vực ạ.",
      "answer": "Dạ bên em giao toàn quốc qua chành xe, Viettel Post hoặc đường sắt. Với đơn sỉ số lượng lớn, ERP4U có hỗ trợ một phần phí vận chuyển; mức hỗ trợ tùy khu vực và đơn hàng, nhân viên kinh doanh sẽ báo cụ thể ạ."
    },
    {
      "seed_key": "kb2.payment.deposit",
      "original": "Dạ khi thông tin đơn hàng đã chính xác, trường chuyển khoản tạm ứng để bên em đưa vào sản xuất; phần còn lại thanh toán khi nhận hàng. Sau khi chuyển khoản, mình gửi ảnh ủy nhiệm chi để kế toán đối chiếu ạ.",
      "answer": "Dạ khi thông tin đơn hàng đã chính xác, trường chuyển khoản tạm ứng để bên em đưa vào sản xuất; phần còn lại thanh toán khi nhận hàng. Mức tạm ứng và thông tin chuyển khoản do kế toán gửi trực tiếp; sau khi chuyển, mình gửi ảnh ủy nhiệm chi để kế toán đối chiếu ạ."
    }
  ],
  "resolve": [
    {
      "code": "D03",
      "resolution": "Chủ dự án duyệt 2026-09-29 (xử lý qua Claude): tách độ dày trước chần (gòn 4–5 cm) và thành phẩm (Cara 1–1,5 cm; Satin 1,5–2 cm). \"3–5 cm\" ở S2 là ruột trước chần."
    },
    {
      "code": "D04",
      "resolution": "Chủ dự án duyệt 2026-09-29 (xử lý qua Claude): foam có sẵn 2,5–3 cm; 3–5 cm là quy cách đặt riêng, kỹ thuật xác nhận theo đơn."
    },
    {
      "code": "D05",
      "resolution": "Chủ dự án duyệt 2026-09-29 (xử lý qua Claude): thêu nệm từ 50 bộ khoảng 10–15 nghìn/cái; thêu chăn khoảng 20 nghìn/cái; giá ngoại lệ do sales báo."
    },
    {
      "code": "D06",
      "resolution": "Chủ dự án duyệt 2026-09-29 (xử lý qua Claude): MOQ theo nhóm hàng: in túi 30; balo mẫu riêng 300/mẫu, số lượng ít chọn mẫu có sẵn; đồng phục 500."
    },
    {
      "code": "D07",
      "resolution": "Chủ dự án duyệt 2026-09-29 (xử lý qua Claude): chỉ nêu thời gian tham khảo (20–30 ngày làm việc; đơn ít 15–20 ngày); ngày giao do sales xác nhận theo lịch sản xuất."
    },
    {
      "code": "D08",
      "resolution": "Chủ dự án duyệt 2026-09-29 (xử lý qua Claude): tem phiên bản hiện tại chỉ ghi Name; trường duyệt mẫu tem trước khi sản xuất."
    },
    {
      "code": "D10",
      "resolution": "Chủ dự án duyệt 2026-09-29 (xử lý qua Claude): miễn phí nội thành TP.HCM khi trả trước; đơn tỉnh hỗ trợ một phần, mức cụ thể sales báo theo đơn (không nêu %)."
    },
    {
      "code": "D16",
      "resolution": "Chủ dự án duyệt 2026-09-29 (xử lý qua Claude): không nêu mức tạm ứng chuẩn; số tài khoản/QR chỉ kế toán gửi trực tiếp, không đưa vào tri thức."
    }
  ]
};
