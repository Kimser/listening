import re
import json

def clean_text(t):
    return re.sub(r'\s+', ' ', t).strip()

def split_zh_en(text):
    text = clean_text(text)
    if not text:
        return "", ""
    
    # Try to find the boundary between Chinese and English
    # Chinese characters: [\u4e00-\u9fff]
    
    # Check if starts with Chinese
    first_char = text[0]
    is_zh_start = '\u4e00' <= first_char <= '\u9fff'
    
    if is_zh_start:
        # If starts with Chinese, English starts at first [a-zA-Z]
        match = re.search(r'([a-zA-Z\'].*)', text)
        if match:
            idx = match.start()
            return text[:idx].strip(), text[idx:].strip()
        else:
            return text, ""
    else:
        # If starts with English, Chinese starts at first [\u4e00-\u9fff]
        match = re.search(r'([\u4e00-\u9fff].*)', text)
        if match:
            idx = match.start()
            # Important: Sometimes "I'd love to... 我很想" 
            # where English is first.
            return text[idx:].strip(), text[:idx].strip()
        else:
            return "", text

def parse_ocr(text):
    # Split by categories (e.g., 1. , 2. , 12. )
    categories = re.split(r'(\d+\.\s*[^\n-]+)', text)
    
    result = []
    
    for i in range(1, len(categories), 2):
        header = categories[i].strip()
        content = categories[i+1].strip() if i+1 < len(categories) else ""
        
        title_match = re.match(r'(\d+)', header)
        if not title_match: continue
        
        lesson_id = int(title_match.group(1))
        
        sentences = []
        # Support splitting by dash or by lines
        # First try dash
        items = re.split(r'\s*-\s*', content)
        if len(items) <= 1:
            # Try splitting by lines if no dashes
            items = content.split('\n')
            
        for item in items:
            item = item.strip()
            if not item: continue
            
            zh, en = split_zh_en(item)
            if zh or en:
                sentences.append({"zh": zh, "en": en})

        result.append({
            "id": lesson_id,
            "category": header,
            "sentences": sentences
        })
    
    return result

with open('/tmp/pdf_ocr.txt', 'r', encoding='utf-8') as f:
    text = f.read()

parsed_data = parse_ocr(text)

with open('/Users/kimser/project/listening/course_data.json', 'w', encoding='utf-8') as f:
    json.dump(parsed_data, f, ensure_ascii=False, indent=2)

print(f"Successfully processed {len(parsed_data)} categories.")
