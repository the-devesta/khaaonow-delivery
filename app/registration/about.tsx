/** Signup step 1 of 3 — name and vehicle. */
import { BottomBar, Button, Choice, Field, Screen } from "@/components/kit";
import SignupHeader from "@/components/signup/SignupHeader";
import { ApiService } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { router } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Text, View } from "react-native";

type Vehicle = "bike" | "scooter" | "bicycle" | "car";

export default function AboutStep() {
  const { t } = useTranslation();
  const partner = useAuthStore((s) => s.partner) as any;
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [name, setName] = useState<string>(partner?.name ?? "");
  const [email, setEmail] = useState<string>(partner?.email ?? "");
  const [vehicle, setVehicle] = useState<Vehicle>((partner?.vehicleType as Vehicle) ?? "bike");
  const [vehicleNumber, setVehicleNumber] = useState<string>(partner?.vehicleNumber ?? "");
  const [licence, setLicence] = useState<string>(partner?.drivingLicenseNumber ?? "");
  const [saving, setSaving] = useState(false);

  const motor = vehicle !== "bicycle";
  const emailInvalid = email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready =
    name.trim().length >= 2 && !emailInvalid && (!motor || (vehicleNumber.trim().length >= 4 && licence.trim().length >= 6));

  const save = async () => {
    setSaving(true);
    try {
      const profile = await ApiService.completeProfile({
        name: name.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      if (!profile.success) throw new Error(profile.message);
      const docs = await ApiService.uploadDocuments({
        vehicleType: vehicle,
        ...(motor
          ? { vehicleNumber: vehicleNumber.trim().toUpperCase(), drivingLicenseNumber: licence.trim().toUpperCase() }
          : {}),
      });
      if (!docs.success) throw new Error(docs.message);
      await fetchProfile();
      router.replace("/registration/documents");
    } catch (error: any) {
      Alert.alert(t("signup.saveFailed"), error?.message || t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <BottomBar>
          <Button title={t("common.continue")} icon="arrow-forward" disabled={!ready} loading={saving} onPress={save} />
        </BottomBar>
      }
      contentStyle={{ paddingTop: 64 }}>
      <SignupHeader step={1} title={t("signup.aboutTitle")} body={t("signup.aboutBody")} />
      <Field label={t("signup.fullName")} value={name} onChangeText={setName} placeholder={t("signup.asOnAadhaar")} autoCapitalize="words" />
      <Field
        label={t("signup.emailOptional")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={emailInvalid ? t("signup.emailInvalid") : undefined}
      />
      <View className="gap-2 mt-1">
        <Text className="text-sm font-semibold text-ink">{t("signup.vehicle")}</Text>
        <View className="flex-row gap-2">
          <Choice icon="bicycle" title={t("signup.bike")} selected={vehicle === "bike"} onPress={() => setVehicle("bike")} />
          <Choice icon="speedometer-outline" title={t("signup.scooter")} selected={vehicle === "scooter"} onPress={() => setVehicle("scooter")} />
        </View>
        <View className="flex-row gap-2">
          <Choice icon="bicycle-outline" title={t("signup.bicycle")} selected={vehicle === "bicycle"} onPress={() => setVehicle("bicycle")} />
          <Choice icon="car-outline" title={t("signup.car")} selected={vehicle === "car"} onPress={() => setVehicle("car")} />
        </View>
      </View>
      {motor ? (
        <>
          <Field
            label={t("signup.vehicleNumber")}
            value={vehicleNumber}
            onChangeText={(v) => setVehicleNumber(v.toUpperCase())}
            placeholder="GJ06AB1234"
            autoCapitalize="characters"
          />
          <Field
            label={t("signup.licenceNumber")}
            value={licence}
            onChangeText={(v) => setLicence(v.toUpperCase())}
            placeholder="GJ0620200001234"
            autoCapitalize="characters"
          />
        </>
      ) : null}
    </Screen>
  );
}
