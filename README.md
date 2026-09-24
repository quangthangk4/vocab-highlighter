# Vocab Highlighter

Chrome extension giúp bạn lưu từ vựng và English patterns để chúng tự được highlight khi xuất hiện trên website.

## Cài đặt

1. Mở `chrome://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked** và chọn thư mục dự án này.
4. Khi cập nhật code, nhấn **Reload** tại trang Extensions.

## Cách dùng

### Lưu từ vựng

- Bôi đen từ/cụm từ trên website → chuột phải → **Save to Vocabulary**.
- Hoặc mở popup extension, nhập từ rồi nhấn **+**.
- Từ đã lưu sẽ được highlight trên các trang web.
- Hover từ được highlight để xem IPA; `Ctrl + click` để thêm/sửa nghĩa; `Ctrl + chuột phải` để xóa nhanh.

### Lưu English pattern

1. Mở popup extension → **Patterns**.
2. Nhập pattern, ví dụ `teach sb how to V` hoặc `be interested in V-ing`.
3. Thêm nghĩa nếu cần → **Save pattern**.
4. Khi gặp cấu trúc phù hợp, extension highlight phần khớp. Click highlight để xem pattern, breakdown, confidence và lưu example.

Pattern hỗ trợ: `sb`, `sth`, `V`, `V-ing`, `adj`, `adv`, `place`, `time`.

Ví dụ: `teach sb how to V` sẽ match `teaching his son how to fish`, nhưng không match `I teach English at school.`

### Prompt chuẩn hóa pattern bằng ChatGPT

Khi có một đoạn tiếng Anh, copy prompt dưới đây vào chat, rồi thay phần `TEXT` bằng đoạn của bạn:

```text
Bạn là trợ lý tạo English learning patterns cho browser extension của tôi.

Hãy trích xuất tối đa 5 patterns hữu ích từ đoạn TEXT bên dưới.
Chỉ dùng đúng các placeholder sau:
- sb = somebody / person
- sth = something / thing
- V = base verb
- V-ing = gerund / present participle
- adj, adv, place, time

Quy tắc bắt buộc:
- KHÔNG dùng các từ: someone, somebody, something, person, thing, object.
- Nếu cần người, luôn ghi sb; nếu cần vật/sự việc, luôn ghi sth.
- Giữ connector cố định, ví dụ: how to, interested in, at the.
- Pattern phải bắt đầu bằng head verb ở dạng base form khi có thể.
- Không tạo pattern quá chung chung chỉ có một từ.
- Chỉ trả về JSON array, không giải thích thêm.

Format mỗi mục:
{
  "pattern": "teach sb how to V",
  "meaning": "dạy ai đó cách làm gì",
  "example": "The father is teaching his son how to fish."
}

TEXT:
"Dán đoạn tiếng Anh ở đây"
```

Sau đó copy giá trị `pattern` vào **Patterns** của extension. Nếu chat trả về `something`, hãy đổi thành `sth` trước khi lưu.

### Chỉnh độ chính xác

Vào **Patterns** trong Settings và chỉnh **Matching confidence**:

- Tăng lên nếu muốn ít highlight hơn nhưng chắc chắn hơn.
- Giảm xuống nếu pattern có object/place/time đa dạng.

## Backup

Trong **Settings → Backup & Restore**:

- Export/import từ vựng bằng `.txt` hoặc `.json`.
- Export/import Pattern Notes bằng JSON.

Từ vựng và cài đặt được đồng bộ qua Chrome. Pattern notes được lưu local và nên export định kỳ để backup.

## Kiểm tra engine

```bash
node tests/pattern-engine.test.js
```
