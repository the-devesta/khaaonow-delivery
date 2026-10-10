/** My details — name and email. Vehicle and documents are checked by KhaaoNow, so support changes them. */
import { BottomBar, Button, Field, ListGroup, ListRow, Screen } from "@/components/kit";
import { ApiService } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { router } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Text } from "react-native";

export default function EditDetails() {
  const { t } = useTranslation();
  const partner = useAuthStore((s) => s.partner) as any;
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const [name, setName] = useState<string>(partner?.name ?? "");
  const [email, setEmail] = useState<string>(partner?.email ?? "");
  const [saving, setSaving] = useState(false);

  const emailOk = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim());
  const ready = name.trim().length >= 2 && emailOk;

  const save = async () => {
    setSaving(true);
    const res = await ApiService.updateProfile({ name: name.trim(), ...(email.trim() ? { email: email.trim() } : {}) });
    setSaving(false);
    if (!res.success) {
      Alert.alert(t("common.failed"), res.message || t("common.tryAgain"));
      return;
    }
    await fetchProfile();
    router.back();
  };

  return (
    <Screen
      title={t("me.details")}
      back
      footer={
        <BottomBar>
          <Button title={t("common.save")} icon="checkmark" disabled={!ready} loading={saving} onPress={save} />
        </BottomBar>
      }>
      <Field label={t("signup.fullName")} value={name} onChangeText={setName} autoCapitalize="words" />
      <Field
        label={t("signup.emailOptional")}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        error={!emailOk ? t("signup.emailInvalid") : undefined}
      />
      <ListGroup>
        <ListRow icon="bicycle-outline" title={t("me.vehicle")} value={[partner?.vehicleType, partner?.vehicleNumber].filter(Boolean).join(" · ") || "—"} />
        <ListRow icon="card-outline" title={t("me.licence")} value={partner?.drivingLicenseNumber || "—"} />
      </ListGroup>
      <Text className="text-xs text-muted px-1">{t("me.lockedHint")}</Text>
    </Screen>
  );
}
