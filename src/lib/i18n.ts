import { register, init, getLocaleFromNavigator } from 'svelte-i18n';

register('he', () => Promise.resolve({
    site_title: "הגמח הארצי",
    site_subtitle: "כל הגמחים תחת קורת גג אחת",
    search_placeholder: "חפש לפי שם, עניין או עיר...",
    search_button: "חפש",
    search_results: "תוצאות חיפוש",
    no_results: "לא נמצאו תוצאות",
    all_categories: "כל הקטגוריות",
    filter_by_city: "סנן לפי עיר",
    all_cities: "כל הערים",
    gemach_name: "שם הגמח",
    gemach_city: "עיר",
    gemach_category: "קטגוריה",
    gemach_phone: "טלפון",
    gemach_description: "תיאור",
    add_gemach: "הוסף גמח",
    contact_us: "צור קשר",
    about: "אודות",
    all_rights_reserved: "כל הזכויות שמורות",
    back_home: "חזרה לדף הבית",
    login_register: "התחבר / הרשם",
    connected: "מחוברים",
    categories: {
        clothing: "ביגוד",
        baby: "תינוקות",
        books: "ספרים",
        furniture: "ריהוט",
        medical: "ציוד רפואי",
        food: "מזון",
        tools: "כלים",
        wedding: "חתונה",
        judaism: "יהדות",
        other: "אחר"
    }
}));

register('en', () => Promise.resolve({
    site_title: "National Gemach",
    site_subtitle: "All Gemachs Under One Roof",
    search_placeholder: "Search by name, topic or city...",
    search_button: "Search",
    search_results: "Search Results",
    no_results: "No results found",
    all_categories: "All Categories",
    filter_by_city: "Filter by City",
    all_cities: "All Cities",
    gemach_name: "Gemach Name",
    gemach_city: "City",
    gemach_category: "Category",
    gemach_phone: "Phone",
    gemach_description: "Description",
    add_gemach: "Add Gemach",
    contact_us: "Contact Us",
    about: "About",
    all_rights_reserved: "All Rights Reserved",
    back_home: "Back to Home",
    login_register: "Login / Register",
    connected: "Online",
    categories: {
        clothing: "Clothing",
        baby: "Baby",
        books: "Books",
        furniture: "Furniture",
        medical: "Medical Equipment",
        food: "Food",
        tools: "Tools",
        wedding: "Wedding",
        judaism: "Judaism",
        other: "Other"
    }
}));

register('ru', () => Promise.resolve({
    site_title: "Национальный Гемах",
    site_subtitle: "Все Гемахи под одной крышей",
    search_placeholder: "Поиск по названию, теме или городу...",
    search_button: "Искать",
    search_results: "Результаты поиска",
    no_results: "Результаты не найдены",
    all_categories: "Все категории",
    filter_by_city: "Фильтр по городу",
    all_cities: "Все города",
    gemach_name: "Название гемаха",
    gemach_city: "Город",
    gemach_category: "Категория",
    gemach_phone: "Телефон",
    gemach_description: "Описание",
    add_gemach: "Добавить гемах",
    contact_us: "Связаться с нами",
    about: "О нас",
    all_rights_reserved: "Все права защищены",
    back_home: "На главную",
    login_register: "Войти / Зарегистрироваться",
    connected: "Онлайн",
    categories: {
        clothing: "Одежда",
        baby: "Для малышей",
        books: "Книги",
        furniture: "Мебель",
        medical: "Медоборудование",
        food: "Еда",
        tools: "Инструменты",
        wedding: "Свадьба",
        judaism: "Иудаизм",
        other: "Другое"
    }
}));

init({
    fallbackLocale: 'he',
    initialLocale: getLocaleFromNavigator() || 'he',
});
