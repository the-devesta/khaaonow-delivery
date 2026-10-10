import { color } from "@/theme/tokens";
import React from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

/** "Step 2 of 3" with a three-segment progress bar. */
export default function SignupHeader({ step, title, body }: { step: 1 | 2 | 3; title: string; body?: string }) {
  const { t } = useTranslation();
  return (
    <View className="gap-2 mb-1">
      <View className="flex-row gap-1.5">
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? color.ink : color.line }}
          />
        ))}
      </View>
      <Text className="text-xs font-bold text-muted uppercase tracking-wide mt-1">
        {t("signup.stepOf", { step, total: 3 })}
      </Text>
      <Text className="text-2xl font-extrabold text-ink">{title}</Text>
      {body ? <Text className="text-sm text-muted">{body}</Text> : null}
    </View>
  );
}
