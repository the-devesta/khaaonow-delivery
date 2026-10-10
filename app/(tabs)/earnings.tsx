/**
 * Earnings — what you'll be paid, what you earned, and cash you're holding.
 * Everything comes from the payout ledger; tap a day to see its trips.
 */
import { Banner, Button, Card, EmptyState, ListGroup, ListRow, Pill, rupees, SectionTitle, Segmented, TabScreen } from "@/components/kit";
import {
  ApiService,
  DeliveryPayoutLedger,
  DeliveryPayoutLedgerOrder,
  DeliveryPayoutPeriod,
} from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { color } from "@/theme/tokens";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

const day = (value?: string) =>
  value ? new Date(value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "—";
const time = (value?: string) =>
  value ? new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";

type DayGroup = { key: string; label: string; total: number; orders: DeliveryPayoutLedgerOrder[] };

export default function EarningsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [period, setPeriod] = useState<DeliveryPayoutPeriod>("week");
  const [ledger, setLedger] = useState<DeliveryPayoutLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    const res = await ApiService.getPayoutLedger(period);
    if (res.success && res.data) setLedger(res.data);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const days = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const o of ledger?.orders ?? []) {
      const key = new Date(o.deliveredAt).toDateString();
      const g = map.get(key) ?? { key, label: day(o.deliveredAt), total: 0, orders: [] };
      g.total += o.earning || 0;
      g.orders.push(o);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => new Date(b.key).getTime() - new Date(a.key).getTime());
  }, [ledger]);

  const partner = useAuthStore((st) => st.partner) as any;
  const hasPayoutAccount = Boolean(partner?.upiId || partner?.bankAccountNumber);
  const summary = ledger?.summary;
  const cash = ledger?.cash;
  const payable = summary?.payableAmount ?? 0;

  const requestPayout = () => {
    Alert.alert(t("earn.requestTitle"), t("earn.requestBody", { amount: rupees(payable) }), [
      { text: t("common.close"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: async () => {
          setRequesting(true);
          const res = await ApiService.requestPayoutWithdrawal(payable);
          setRequesting(false);
          Alert.alert(res.success ? t("earn.requested") : t("common.failed"), res.message);
        },
      },
    ]);
  };

  return (
    <TabScreen
      title={t("earn.title")}
      refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
      }>

        {/* What KhaaoNow owes you */}
        <View className="rounded-3xl p-5 gap-1" style={{ backgroundColor: color.ink }}>
          <Text className="text-sm font-semibold" style={{ color: color.faint }}>
            {t("earn.toBePaid")}
          </Text>
          <Text className="text-4xl font-extrabold" style={{ color: color.brand }}>
            {rupees(payable)}
          </Text>
          <Text className="text-sm" style={{ color: color.faint }}>
            {summary?.nextPayoutDate ? t("earn.nextPayout", { date: day(summary.nextPayoutDate) }) : t("earn.paidWeekly")}
          </Text>
          {!hasPayoutAccount ? (
            <View className="mt-3">
              <Button title={t("earn.addPayout")} icon="wallet-outline" onPress={() => router.push("/profile/payments")} />
            </View>
          ) : payable > 0 ? (
            <View className="mt-3">
              <Button title={t("earn.requestNow")} icon="cash-outline" loading={requesting} onPress={requestPayout} />
            </View>
          ) : null}
        </View>

        {/* Cash you're holding */}
        {cash && cash.cashInHand > 0 ? (
          <Banner
            tone="warning"
            icon="wallet-outline"
            title={t("earn.cashInHand", { amount: rupees(cash.cashInHand) })}
            body={t("earn.cashInHandBody")}
          />
        ) : null}

        <Segmented
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setOpenDay(null);
          }}
          options={[
            { value: "today", label: t("earn.today") },
            { value: "week", label: t("earn.week") },
            { value: "month", label: t("earn.month") },
          ]}
        />

        <View className="flex-row gap-3">
          <Card style={{ flex: 1 }}>
            <Text className="text-sm text-muted">{t("earn.earned")}</Text>
            <Text className="text-2xl font-extrabold text-ink">{rupees(summary?.periodEarned)}</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text className="text-sm text-muted">{t("earn.trips")}</Text>
            <Text className="text-2xl font-extrabold text-ink">{summary?.periodOrders ?? 0}</Text>
          </Card>
        </View>

        {/* Trips by day */}
        <SectionTitle title={t("earn.byDay")} />
        {loading ? (
          <ActivityIndicator color={color.ink} style={{ paddingVertical: 32 }} />
        ) : days.length === 0 ? (
          <EmptyState icon="bicycle-outline" title={t("earn.noTrips")} body={t("earn.noTripsBody")} />
        ) : (
          days.map((g) => {
            const open = openDay === g.key;
            return (
              <Card key={g.key} padded={false}>
                <Pressable
                  onPress={() => setOpenDay(open ? null : g.key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  className="flex-row items-center px-4 py-3.5 gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">{g.label}</Text>
                    <Text className="text-sm text-muted">{t("earn.tripCount", { count: g.orders.length })}</Text>
                  </View>
                  <Text className="text-lg font-extrabold text-success">{rupees(g.total)}</Text>
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={color.faint} />
                </Pressable>
                {open
                  ? g.orders.map((o) => (
                      <View key={o.id} className="flex-row items-center gap-3 px-4 py-3 border-t border-line">
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                            {o.restaurantName}
                          </Text>
                          <Text className="text-xs text-muted">
                            #{o.orderNumber} · {time(o.deliveredAt)}
                            {o.distanceKm ? ` · ${o.distanceKm.toFixed(1)} km` : ""}
                          </Text>
                        </View>
                        {o.cashCollected > 0 ? <Pill label={t("earn.cash", { amount: rupees(o.cashCollected) })} tone="warning" /> : null}
                        <Text className="text-base font-bold text-ink">{rupees(o.earning)}</Text>
                      </View>
                    ))
                  : null}
              </Card>
            );
          })
        )}

        {/* Payouts received */}
        {ledger?.settlements?.length ? (
          <>
            <SectionTitle title={t("earn.payouts")} />
            <ListGroup>
              {ledger.settlements.map((s) => (
                <ListRow
                  key={s.id}
                  icon={s.status === "paid" ? "checkmark-circle-outline" : "time-outline"}
                  title={rupees(s.amount)}
                  subtitle={`${day(s.periodStart)} – ${day(s.periodEnd)} · ${s.status === "paid" ? t("earn.paid") : t("earn.scheduled")}`}
                  onPress={s.proofUrl ? () => Linking.openURL(s.proofUrl!) : undefined}
                />
              ))}
            </ListGroup>
          </>
        ) : null}

        {/* Cash handed over */}
        {cash?.remittances?.length ? (
          <>
            <SectionTitle title={t("earn.cashHanded")} />
            <ListGroup>
              {cash.remittances.map((r) => (
                <ListRow key={r.id} icon="arrow-up-circle-outline" title={rupees(r.amount)} subtitle={r.notes || day(r.remittedAt)} />
              ))}
            </ListGroup>
          </>
        ) : null}
    </TabScreen>
  );
}
