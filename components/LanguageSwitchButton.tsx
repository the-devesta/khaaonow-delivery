import { AppLanguage, LANGUAGES, setSavedLanguage } from "@/i18n";
import { Ionicons } from "@expo/vector-icons";
import { Alert, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";

type LanguageSwitchButtonProps = {
  /** "light" sits on a plain/colored background (e.g. login screen).
   *  "card" matches the white circular icon buttons used in app headers. */
  variant?: "light" | "card";
  style?: any;
};

export function LanguageSwitchButton({
  variant = "card",
  style,
}: LanguageSwitchButtonProps) {
  const { t, i18n } = useTranslation();

  const handlePress = () => {
    Alert.alert(t("settings.chooseLanguage"), "", [
      ...LANGUAGES.map((language) => ({
        text: language.nativeLabel,
        onPress: () => setSavedLanguage(language.code as AppLanguage),
      })),
      { text: t("common.cancel"), style: "cancel" as const },
    ]);
  };

  const isLight = variant === "light";

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className={
        isLight
          ? "flex-row items-center bg-white/90 rounded-full px-3 h-10"
          : "w-12 h-12 bg-white rounded-full items-center justify-center"
      }
      style={[
        isLight
          ? {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 6,
              elevation: 2,
            }
          : undefined,
        style,
      ]}>
      <Ionicons name="language-outline" size={isLight ? 18 : 22} color="#F59E0B" />
      {isLight && (
        <Ionicons
          name="chevron-down"
          size={12}
          color="#9CA3AF"
          style={{ marginLeft: 2 }}
        />
      )}
    </TouchableOpacity>
  );
}
