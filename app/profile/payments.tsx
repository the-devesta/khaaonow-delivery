/** Payout account — where KhaaoNow sends your earnings (UPI or bank). */
import { BottomBar, Button, Choice, Field, Screen } from "@/components/kit";
import { ApiService } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { router } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";

export default function PayoutAccount() {
  const { t } = useTranslation();
  const partner = useAuthStore((s) => s.partner) as any;
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [mode, setMode] = useState<"upi" | "bank">(partner?.upiId || !partner?.bankAccountNumber ? "upi" : "bank");
  const [upi, setUpi] = useState<string>(partner?.upiId ?? "");
  const [holder, setHolder] = useState<string>(partner?.bankAccountName ?? partner?.name ?? "");
  const [account, setAccount] = useState<string>(partner?.bankAccountNumber ?? "");
  const [ifsc, setIfsc] = useState<string>(partner?.bankIFSC ?? "");
  const [saving, setSaving] = useState(false);

  const upiOk = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi.trim());
  const ifscOk = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase());
  const accountOk = /^\d{9,18}$/.test(account);
  const ready = mode === "upi" ? upiOk : holder.trim().length >= 2 && accountOk && ifscOk;

  const save = async () => {
    setSaving(true);
    const res = await ApiService.updateProfile(
      mode === "upi"
        ? { upiId: upi.trim() }
        : { bankAccountName: holder.trim(), bankAccountNumber: account, bankIFSC: ifsc.trim().toUpperCase() },
    );
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
      title={t("me.payout")}
      back
      footer={
        <BottomBar>
          <Button title={t("common.save")} icon="checkmark" disabled={!ready} loading={saving} onPress={save} />
        </BottomBar>
      }>
      <View className="flex-row gap-3">
        <Choice icon="flash-outline" title={t("signup.upi")} subtitle={t("signup.upiHint")} selected={mode === "upi"} onPress={() => setMode("upi")} />
        <Choice icon="business-outline" title={t("signup.bank")} subtitle={t("signup.bankHint")} selected={mode === "bank"} onPress={() => setMode("bank")} />
      </View>
      {mode === "upi" ? (
        <Field
          label={t("signup.upiId")}
          value={upi}
          onChangeText={setUpi}
          autoCapitalize="none"
          placeholder="name@okaxis"
          error={upi && !upiOk ? t("signup.upiInvalid") : undefined}
        />
      ) : (
        <>
          <Field label={t("signup.holderName")} value={holder} onChangeText={setHolder} autoCapitalize="words" />
          <Field
            label={t("signup.accountNumber")}
            value={account}
            onChangeText={(v) => setAccount(v.replace(/\D/g, ""))}
            keyboardType="number-pad"
            error={account && !accountOk ? t("signup.accountInvalid") : undefined}
          />
          <Field
            label={t("signup.ifsc")}
            value={ifsc}
            onChangeText={(v) => setIfsc(v.toUpperCase())}
            autoCapitalize="characters"
            placeholder="SBIN0001234"
            error={ifsc && !ifscOk ? t("signup.ifscInvalid") : undefined}
          />
        </>
      )}
    </Screen>
  );
}
