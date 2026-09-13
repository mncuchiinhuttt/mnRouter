import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "./vi";
import en from "./en";

const stored = typeof localStorage !== "undefined" ? localStorage.getItem("mn-lang") : null;
const initial = stored === "en" || stored === "vi" ? stored : "vi";

void i18n.use(initReactI18next).init({
	resources: {
		vi: { translation: vi },
		en: { translation: en },
	},
	lng: initial,
	fallbackLng: "en",
	interpolation: { escapeValue: false },
});

export function setLang(lang: "vi" | "en") {
	localStorage.setItem("mn-lang", lang);
	void i18n.changeLanguage(lang);
}

export default i18n;
