/**
 * Signup step 2 of 3 — every document on one screen. Each photo uploads and
 * saves the moment it's taken, so leaving and coming back keeps progress.
 */
import { Banner, BottomBar, Button, Field, Screen } from "@/components/kit";
import DocTile from "@/components/signup/DocTile";
import SignupHeader from "@/components/signup/SignupHeader";
import { ApiService } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { router } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Text, View } from "react-native";

type DocField = "aadhaarPhoto" | "panPhoto" | "drivingLicensePhoto" | "rcPhoto" | "profilePhoto";

export default function DocumentsStep() {
  const { t } = useTranslation();
  const partner = useAuthStore((s) => s.partner) as any;
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const motor = (partner?.vehicleType ?? "bike") !== "bicycle";

  const [aadhaar, setAadhaar] = useState<string>(partner?.aadhaarNumber ?? "");
  const [pan, setPan] = useState<string>(partner?.panNumber ?? "");
  const [docs, setDocs] = useState<Record<DocField, string | undefined>>({
    aadhaarPhoto: partner?.aadhaarPhoto,
    panPhoto: partner?.panPhoto,
    drivingLicensePhoto: partner?.drivingLicensePhoto,
    rcPhoto: partner?.rcPhoto,
    profilePhoto: partner?.profilePhoto,
  });
  const [saving, setSaving] = useState(false);

  const saveDoc = async (field: DocField, reference: string) => {
    setDocs((d) => ({ ...d, [field]: reference }));
    const res = await ApiService.uploadDocuments({ [field]: reference });
    if (!res.success) Alert.alert(t("signup.saveFailed"), res.message || t("common.tryAgain"));
  };

  const aadhaarDigits = aadhaar.replace(/\s/g, "");
  const aadhaarOk = /^\d{12}$/.test(aadhaarDigits);
  const panOk = /^[A-Z]{5}\d{4}[A-Z]$/.test(pan.trim().toUpperCase());
  const required: DocField[] = ["aadhaarPhoto", "panPhoto", "profilePhoto", ...(motor ? (["drivingLicensePhoto", "rcPhoto"] as DocField[]) : [])];
  const missing = required.filter((f) => !docs[f]).length;
  const ready = aadhaarOk && panOk && missing === 0;

  const save = async () => {
    setSaving(true);
    try {
      const res = await ApiService.uploadDocuments({ aadhaarNumber: aadhaarDigits, panNumber: pan.trim().toUpperCase() });
      if (!res.success) throw new Error(res.message);
      await fetchProfile();
      router.replace("/registration/payout");
    } catch (error: any) {
      Alert.alert(t("signup.saveFailed"), error?.message || t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      back={() => router.replace("/registration/about")}
      footer={
        <BottomBar>
          {missing > 0 ? (
            <Text className="text-xs text-muted text-center">{t("signup.photosLeft", { count: missing })}</Text>
          ) : null}
          <Button title={t("common.continue")} icon="arrow-forward" disabled={!ready} loading={saving} onPress={save} />
        </BottomBar>
      }>
      <SignupHeader step={2} title={t("signup.docsTitle")} body={t("signup.docsBody")} />

      <Banner tone="info" icon="shield-checkmark-outline" title={t("signup.privateTitle")} body={t("signup.privateBody")} />

      <View className="flex-row gap-3">
        <DocTile label={t("signup.selfie")} folder="profile_photos" selfie value={docs.profilePhoto} onUploaded={(r) => saveDoc("profilePhoto", r)} />
        <View className="flex-1" />
      </View>

      <Field
        label={t("signup.aadhaarNumber")}
        value={aadhaar}
        onChangeText={(v) => setAadhaar(v.replace(/[^\d\s]/g, "").slice(0, 14))}
        keyboardType="number-pad"
        placeholder="1234 5678 9012"
        error={aadhaar && !aadhaarOk ? t("signup.aadhaarInvalid") : undefined}
      />
      <Field
        label={t("signup.panNumber")}
        value={pan}
        onChangeText={(v) => setPan(v.toUpperCase().slice(0, 10))}
        autoCapitalize="characters"
        placeholder="ABCDE1234F"
        error={pan && !panOk ? t("signup.panInvalid") : undefined}
      />
      <View className="flex-row gap-3">
        <DocTile label={t("signup.aadhaarCard")} folder="kyc_docs" value={docs.aadhaarPhoto} onUploaded={(r) => saveDoc("aadhaarPhoto", r)} />
        <DocTile label={t("signup.panCard")} folder="kyc_docs" value={docs.panPhoto} onUploaded={(r) => saveDoc("panPhoto", r)} />
      </View>
      {motor ? (
        <View className="flex-row gap-3">
          <DocTile label={t("signup.licence")} folder="kyc_docs" value={docs.drivingLicensePhoto} onUploaded={(r) => saveDoc("drivingLicensePhoto", r)} />
          <DocTile label={t("signup.rc")} folder="kyc_docs" value={docs.rcPhoto} onUploaded={(r) => saveDoc("rcPhoto", r)} />
        </View>
      ) : null}
    </Screen>
  );
}
