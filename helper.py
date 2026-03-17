import os
import json

# Шлях до української локалізації
ua_path = r'D:\Python\cashclash.github.io\i18n\ua\data'

# Словник замін (англійське значення: українське значення)
translation_map = {
    "Non-profit organization": "Неприбуткова організація",
    "city": "місто",
    "corporation": "корпорація",
    "country": "країна",
    "department": "департамент",
    "government": "уряд",
    "person": "особа",
    "supranational-organisation": "наднаціональна організація"
}


def translate_categories(folder_path):
    if not os.path.exists(folder_path):
        print(f"Помилка: Шлях '{folder_path}' не знайдено.")
        return

    files = [f for f in os.listdir(folder_path) if f.endswith('.json')]
    updated_count = 0

    for file_name in files:
        full_path = os.path.join(folder_path, file_name)

        try:
            # 1. Читаємо файл
            with open(full_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 2. Перевіряємо, чи є категорія в нашому словнику замін
            current_category = data.get("category")
            if current_category in translation_map:
                # Замінюємо на українське значення
                data["category"] = translation_map[current_category]

                # 3. Записуємо оновлені дані назад у файл
                with open(full_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                print(f"✅ Оновлено: {file_name} ('{current_category}' -> '{data['category']}')")
                updated_count += 1

        except Exception as e:
            print(f"❌ Помилка при обробці {file_name}: {e}")

    print(f"\nГотово! Всього оновлено файлів: {updated_count}")


# Запуск
translate_categories(ua_path)