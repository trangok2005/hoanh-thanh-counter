# Hoành Thánh Counter

Đếm số phần món (hoành thánh, mì, bún, snack, sữa), tính tổng viên
nước/chiên và lập báo cáo doanh thu nhanh. Hỗ trợ quét ảnh POS bằng AI vision
(OpenRouter).

## Chạy

```bash
python -m http.server 8000
# mở http://localhost:8000
```

Không cần build, không có dependency runtime. ES modules thuần, chạy được trên
GitHub Pages (đường dẫn tương đối, `.nojekyll`).

## Kiểm thử

```bash
node --test tests/*.test.js
```

Chỉ test logic thuần (domain, report formatter, parser, prompt, retry, errors,
storage). Không cần cài thêm gì.

## Tính năng

- **Đếm món** (`#dem-mon`): bảng 12 món chia 3 nhóm (Món có HT, Món khác, Sữa).
  Chỉ nhóm có HT mới cộng viên nước/chiên.
- **Báo cáo** (`#bao-cao`): nhập ngày, loại báo cáo, doanh thu theo kênh
  (CK/TM/Thẻ/Grab/Shopee), nhiều phiếu chi, số lượng huỷ; xem trước dạng text và
  sao chép một lần.
- **Quét ảnh**: chụp màn hình POS, AI trả số lượng; người dùng rà lại trước khi
  áp dụng (cộng dồn hoặc thay thế).
- Tự động lưu Order (`hoanh-thanh-counter:v1`) và Báo cáo
  (`hoanh-thanh-counter:report:v1`) vào localStorage, đồng bộ giữa các tab.

## Cấu trúc

```
index.html            # giữ nguyên id/class gốc + tabs + #report-panel
style.css             # giao diện, tabs, báo cáo, card mobile
js/
  main.js             # composition root: nối mọi thứ, không chứa logic
  config.js           # CATEGORIES, METRICS, MENU, REPORT_GROUPS, PAYMENT_CHANNELS,
                      # REPORT_FORMAT, AI_CONFIG, hằng số
  domain/
    quantity.js       # sanitizeQuantity, sanitizeMoney, formatDateDDMM
    validateConfig.js # kiểm tra cấu hình lúc khởi động
    Order.js          # state số phần (pub/sub)
    Report.js         # state báo cáo (pub/sub)
    calculate.js      # calculateOrder, calculateRevenue, calculateByReportGroup
    reportFormatter.js# formatReport - nơi duy nhất định nghĩa text báo cáo
  storage/
    LocalStorageRepository.js # Order + Report repository
    StatePersistence.js       # auto-save debounce + cross-tab helper
    SaveState.js              # SAVING / SAVED / ERROR
  ai/
    errors.js         # AIError + AuthError/ProviderError/NetworkError/TimeoutError
    providers.js      # VisionProvider, OpenAICompatibleProvider, OpenRouterProvider
    tasks/OrderScanTask.js    # buildPrompt + parse cho quét món
    parser.js         # parseScanResponse(text, menu)
    image.js          # resizeImage(file) - resize đúng 1 lần
    retry.js          # withRetry(fn, opts) - chỉ retry lỗi retryable
    ScanService.js    # prepare + scan(provider + task)
  ui/
    dom.js, Tabs.js, ItemRowView.js, OrderTableView.js, SummaryView.js
    AddItemForm.js, ReportView.js
    ConfirmDialog.js, ApiKeyDialog.js, ScanDialog.js
    Toast.js, SaveStatusView.js
  app/
    ScanController.js # nối dialog + ScanService + Order (token + abort)
tests/
```

## Phụ thuộc

```
ui ──► (dom, config)
app ─► ai, domain
ai ──► domain, config
storage ─► config
domain ─► config              # KHÔNG import ai/ui/storage, không đụng DOM
main.js nối tất cả
```

`StatePersistence` chỉ phụ thuộc interface `{ load, save }`.
`ScanService` nhận `{ provider, task, menu, categories }`; provider trả text thô,
task tự build prompt và parse.

## Thêm món

Thêm object vào `MENU` trong `js/config.js`; Order, tính tổng, prompt AI, parser
và báo cáo tự nhận:

```js
{
  id: 'hoanh-thanh-hap',
  name: 'Hoành thánh hấp',
  variant: null,
  category: 'ht',              // ht | other | milk
  yields: { water: 0, fried: 0 },
  aliases: ['Hoành Thánh Hấp'],// tên đúng trên máy POS
  hints: ['Món này thường nằm cuối bảng'],
  reportGroup: 'ht-chien',     // id trong REPORT_GROUPS
}
```

## Thêm chỉ số

1. Thêm `{ id: 'steam', label: 'Hấp', cancelLabel: 'hấp' }` vào `METRICS`.
2. Thêm `steam: <số viên/phần>` vào `yields` của các món thuộc nhóm có HT.
3. Tổng, báo cáo và dòng "Huỷ" tự cập nhật; thêm cột UI nếu muốn hiển thị.

## Thêm kênh thanh toán / nhóm báo cáo

Sửa `PAYMENT_CHANNELS` hoặc `REPORT_GROUPS` trong `js/config.js`. Form báo cáo và
text xuất tự thay đổi, không sửa `reportFormatter.js`.

## Thêm AI provider

Kế thừa `VisionProvider` (hoặc `OpenAICompatibleProvider`) và thêm vào `REGISTRY`:

```js
class MyProvider extends OpenAICompatibleProvider {
  constructor(cfg) {
    super({ ...cfg, headers: { 'X-Custom': '...', ...cfg.headers } });
  }
}

export const REGISTRY = {
  openrouter: (cfg) => new OpenRouterProvider(cfg),
  mine: (cfg) => new MyProvider(cfg),
};
```

Sau đó đổi `createProvider('openrouter', ...)` trong `main.js` thành `'mine'`.
`ScanService`, `retry.js`, `ScanController` và UI không cần sửa.

## Thêm loại quét mới

Tạo một task có `buildPrompt(menu, categories)` và `parse(text, menu)`, rồi
truyền vào `new ScanService({ provider, task, ... })`. Không sửa ScanService.
