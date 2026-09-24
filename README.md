# 📖 Vocab Highlighter

> Gặp lại từ vựng mỗi ngày — không cần flashcard, không cần app riêng.

---

## 🌱 Lý do ra đời

Học từ vựng tiếng Anh theo kiểu truyền thống — nhìn danh sách, đọc thuộc, làm bài tập — thường không hiệu quả vì thiếu **ngữ cảnh thực tế** và **tần suất tiếp xúc**.

Nghiên cứu về việc học ngôn ngữ chỉ ra rằng để nhớ một từ mới, bạn cần gặp nó ít nhất **7–10 lần** trong các ngữ cảnh khác nhau. Vấn đề là chúng ta dành phần lớn thời gian đọc báo, đọc tài liệu kỹ thuật, lướt web — nhưng những từ đang học lại nằm im trong một cuốn sổ tay hay một app riêng biệt.

**Vocab Highlighter** ra đời để giải quyết đúng vấn đề đó:

> Thay vì bạn tìm đến từ vựng, hãy để từ vựng tự xuất hiện trước mắt bạn — ngay trên những trang web bạn đang đọc mỗi ngày.

---

## 🎯 Mục đích

Vocab Highlighter là một Chrome Extension giúp bạn **học từ vựng thụ động** trong lúc lướt web thông thường.

- Bạn lưu một từ mới gặp hôm nay.
- Từ ngày mai, mỗi khi từ đó xuất hiện trên bất kỳ trang web nào — bài báo, tài liệu, GitHub, Medium, Reddit — nó sẽ tự động được **tô vàng** ngay trước mắt bạn.
- Bạn hover vào từ đó để xem phiên âm IPA của cả giọng Mỹ lẫn giọng Anh.
- Dần dần, bạn gặp từ đó đủ nhiều lần để nhớ mà không cần cố gắng.

Không cần thay đổi thói quen. Không cần mở thêm app. Việc học diễn ra ngay trong luồng đọc hàng ngày của bạn.

---

## 🚀 Cài đặt

1. Tải file `vocab-highlighter-v3.zip` về máy và giải nén
2. Mở Chrome, truy cập `chrome://extensions`
3. Bật **Developer mode** (góc trên bên phải)
4. Nhấn **Load unpacked** → chọn thư mục `vocab-highlighter-v3`
5. Icon 📖 xuất hiện trên thanh toolbar là xong

> 💡 Khi cập nhật lên phiên bản mới, chỉ cần nhấn 🔄 **Reload** trên trang extensions.  
> Danh sách từ của bạn **không bao giờ bị mất** khi cập nhật vì được lưu trên `chrome.storage.sync`.

---

## 📖 Hướng dẫn sử dụng

### Lưu từ mới

**Cách 1 — Nút bookmark nhanh**
1. Bôi đen bất kỳ từ hoặc cụm từ nào trên trang web
2. Nhấn nút 🔖 **Save** xuất hiện ngay bên dưới vùng bôi đen

**Cách 2 — Chuột phải**
1. Bôi đen từ muốn lưu
2. Chuột phải → chọn **📖 Save "từ" to Vocabulary**

**Cách 3 — Nhập tay trong Popup**
1. Nhấn icon 📖 trên toolbar
2. Gõ từ vào ô nhập → nhấn **Enter** hoặc nút **＋**

---

### Xem từ đã lưu

Nhấn icon 📖 trên toolbar để mở popup. Tại đây bạn có thể:
- Xem toàn bộ danh sách từ đã lưu
- Tìm kiếm từ bằng ô search
- Xóa từng từ bằng nút **✕**
- Export danh sách ra file `.txt`

---

### Xem phiên âm IPA

Hover chuột vào bất kỳ từ nào đang được tô vàng trên trang. Một tooltip sẽ hiện ra với:
- 🇺🇸 Phiên âm **giọng Mỹ** (American English)
- 🇬🇧 Phiên âm **giọng Anh** (British English)

---

### Xóa từ nhanh khi đang đọc

Giữ `Ctrl` + chuột phải vào từ đang được tô vàng → từ đó bị xóa ngay khỏi danh sách và bỏ highlight trên toàn bộ trang.

Dùng khi bạn cảm thấy đã nhớ vững từ đó rồi và không cần nhắc nhở nữa.

---

## 🧩 English Pattern Notes & Pattern Matching

Ngoài từng từ đơn lẻ, extension có thể lưu **English patterns/chunks** như:

- `teach sb how to V`
- `sit at the table`
- `be interested in V-ing`
- `have difficulty V-ing`

Trong popup, nhấn **Patterns** để mở Settings → **Pattern Notes**. Nhập pattern và nghĩa (tuỳ chọn); giao diện sẽ cho xem trước cấu trúc đã chuẩn hoá trước khi lưu.

### Pattern được lưu như thế nào?

Pattern được lưu tại `chrome.storage.local` trong `patternNotes`, dưới dạng note có AST, trạng thái học và examples — không chỉ là raw string. Điều này tránh giới hạn dung lượng nhỏ trên từng mục của Chrome Sync khi lưu nhiều examples; dùng **Export pattern notes** để backup/migrate chúng.

```json
{
  "rawPattern": "teach sb how to V",
  "normalizedPattern": {
    "kind": "verb-construction",
    "head": { "type": "VERB", "lemma": "teach", "inflection": "any-form" },
    "sequence": [
      { "type": "PLACEHOLDER", "slot": "PERSON", "raw": "sb" },
      { "type": "LITERAL", "value": "how", "raw": "how" },
      { "type": "LITERAL", "value": "to", "raw": "to" },
      { "type": "PLACEHOLDER", "slot": "VERB_BASE", "raw": "V" }
    ]
  },
  "meaning": "dạy ai đó cách làm gì",
  "status": "learning",
  "examples": []
}
```

Các placeholder hiện hỗ trợ: `sb` (PERSON), `sth` (THING), `V` (base verb), `V-ing` (gerund), `adj`, `adv`, `place`, và `time`. Thiết kế AST này cho phép bổ sung slot mới mà không thay đổi dữ liệu cũ.

### Matching hoạt động ra sao?

Pipeline local-first:

```text
Text node trên webpage
  → candidate head verb (lemma/inflection)
  → kiểm tra connector và placeholder theo thứ tự
  → chấm confidence theo từng slot
  → highlight nếu đạt threshold
  → candidate thấp điểm (AI adapter tùy chọn trong tương lai)
```

Vì kiểm tra cấu trúc đầy đủ, `I teach English at school.` sẽ không match `teach sb how to V`, còn `The father is teaching his son how to fish.` sẽ highlight `teaching his son how to fish` và hiển thị breakdown `teach → teaching`, `sb → his son`, `V → fish` khi click.

Local matching xử lý nhanh các biến thể `teach/teaches/taught/teaching`, `sit/sits/sat/sitting`, `be/is/was/are/became`, và `have/has/had/having`. Regex thuần chỉ phù hợp để tokenize; stemming/lemmatization được dùng cho biến thể, còn structure matcher chịu trách nhiệm chống false-positive. Không dùng embedding hay LLM cho mọi câu vì không đảm bảo quan hệ ngữ pháp, làm extension nặng và có thể đưa nội dung trang ra ngoài. AI fallback mặc định tắt, chưa gửi dữ liệu trang khi người dùng chưa tự cấu hình provider.

### Tương tác với kết quả pattern

Click phần được highlight để xem Pattern, Found in, Meaning, confidence, và Breakdown. Từ inspector có thể lưu example, đánh dấu đã học, để review sau, sửa/xem tất cả examples trong Pattern Notes, hoặc xóa pattern.

Trong Pattern Notes, đặt **Matching confidence** (mặc định 85%). Tăng threshold để giảm highlight không chắc chắn; giảm vừa phải nếu pattern chứa `place`, `time`, hay object phrase rộng.

---

### Cài đặt giao diện

Nhấn **⚙️** trong popup (hoặc vào `chrome://extensions` → Vocab Highlighter → **Extension options**) để mở trang Settings.

| Tuỳ chỉnh | Mô tả |
|---|---|
| Màu highlight | Chọn màu nền của từ được tô (mặc định vàng) |
| Màu chữ | Màu chữ bên trong highlight |
| Font weight | Chữ đậm hoặc thường |
| Bật/tắt highlight | Tắt toàn bộ highlight khi cần |
| Bật/tắt tooltip IPA | Ẩn tooltip nếu không cần |
| Độ rộng tooltip | Kéo slider để điều chỉnh kích thước tooltip |

---

### Backup & Restore

Trong trang Settings → tab **Backup & Restore**:

- **Export .txt** — Tải danh sách từ về dưới dạng file text, mỗi từ một dòng
- **Export .json** — Tải về dạng JSON array, tiện để import lại hoặc dùng với tool khác
- **Export pattern notes** — Tải AST, nghĩa, trạng thái và examples của patterns về JSON
- **Import** — Kéo thả hoặc chọn file `.txt`/`.json` để nhập words hoặc file pattern-notes JSON (tự động bỏ qua mục trùng)
- **Xóa tất cả** — Xoá toàn bộ danh sách (có xác nhận trước khi xoá)

> ☁️ Từ vựng tự đồng bộ qua tài khoản Google trên mọi thiết bị Chrome của bạn.

---

## 💡 Mẹo sử dụng hiệu quả

- **Đừng lưu quá nhiều từ một lúc.** 10–20 từ đang học là lý tưởng. Khi đã nhớ vững thì xóa đi (`Ctrl + chuột phải`) và thêm từ mới.
- **Đọc nhiều thể loại khác nhau.** Từ vựng sẽ xuất hiện trong nhiều ngữ cảnh hơn — kỹ thuật, tin tức, văn học — giúp bạn hiểu sắc thái của từ.
- **Kết hợp với việc nghe.** Hover xem IPA xong thì tìm nghe thêm trên YouTube hay podcast để khắc sâu phát âm.
- **Export định kỳ** để backup danh sách từ quan trọng của bạn.

---

## 📋 Changelog

### v5.0.0
- Thêm English Pattern Notes, structured normalization và local grammatical matching
- Thêm highlight pattern có confidence threshold và inspector/breakdown khi click
- Thêm export/import cho pattern notes

### v4.0.0
- Thêm `Ctrl + Left-click` để nhập / sửa nghĩa của từ
- Tooltip hiển thị nghĩa (nếu có) ngay phía trên phiên âm IPA



### v3.0.0
- Thêm `Ctrl + Chuột phải` để xóa từ nhanh ngay khi đang đọc

### v2.0.0
- Nút bookmark nổi xuất hiện khi bôi đen văn bản
- Tooltip IPA hiển thị cả giọng Mỹ 🇺🇸 lẫn giọng Anh 🇬🇧
- Trang Settings đầy đủ với tuỳ chỉnh giao diện
- Slider điều chỉnh độ rộng tooltip
- Sửa lỗi IPA bị chặn bởi Content-Security-Policy của một số trang
- Từ vựng không mất khi cập nhật extension

### v1.0.0
- Phiên bản đầu tiên — lưu từ, highlight, tooltip cơ bản

---

*Được xây dựng với Manifest V3 · Không có quảng cáo · Không thu thập dữ liệu*
