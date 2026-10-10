/** Signup step 3 of 3 — where to send earnings (UPI or bank). */
import { BottomBar, Button, Choice, Field, Screen } from "@/components/kit";
import DocTile from "@/components/signup/DocTile";
import SignupHeader from "@/components/signup/SignupHeader";
import { ApiService } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { router } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";

export default function PayoutStep() {
  const { t } = useTranslation();
  const partner = useAuthStore((s) => s.partner) as any;
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [mode, setMode] = useState<"upi" | "bank">(partner?.bankAccountNumber ? "bank" : "upi");
  const [upi, setUpi] = useState<string>(partner?.upiId ?? "");
  const [holder, setHolder] = useState<string>(partner?.bankAccountName ?? partner?.name ?? "");
  const [account, setAccount] = useState<string>(partner?.bankAccountNumber ?? "");
  const [ifsc, setIfsc] = useState<string>(partner?.bankIFSC ?? "");
  const [proof, setProof] = useState<string | undefined>(partner?.bankAccountPhoto);
  const [saving, setSaving] = useState(false);

  const upiOk = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi.trim());
  const ifscOk = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase());
  const accountOk = /^\d{9,18}$/.test(account.replace(/\s/g, ""));
  const ready = mode === "upi" ? upiOk : holder.trim().length >= 2 && accountOk && ifscOk;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await ApiService.addBankDetails(
        mode === "upi"
          ? { upiId: upi.trim() }
          : {
              bankAccountName: holder.trim(),
              bankAccountNumber: account.replace(/\s/g, ""),
              bankIFSC: ifsc.trim().toUpperCase(),
              ...(proof ? { bankAccountPhoto: proof } : {}),
            },
      );
      if (!res.success) throw new Error(res.message);
      await fetchProfile();
      router.replace("/registration/account-pending");
    } catch (error: any) {
      Alert.alert(t("signup.saveFailed"), error?.message || t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      back={() => router.replace("/registration/documents")}
      footer={
        <BottomBar>
          <Button title={t("signup.submit")} icon="checkmark-circle" disabled={!ready} loading={saving} onPress={submit} />
        </BottomBar>
      }>
      <SignupHeader step={3} title={t("signup.payoutTitle")} body={t("signup.payoutBody")} />
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
            onChangeText={(v) => setAccount(v.replace(/[^\d]/g, ""))}
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
          <View className="flex-row gap-3">
            <DocTile label={t("signup.bankProof")} folder="bank_document" value={proof} onUploaded={(r) => setProof(r)} />
            <View className="flex-1" />
          </View>
        </>
      )}
    </Screen>
  );
}
