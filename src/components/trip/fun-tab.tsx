import { Card, HelperText, SectionTitle } from '@/components/ui/card';
import GuessCard from '@/components/trip/guess-card';
import SoundtrackCard from '@/components/trip/soundtrack-card';
import SpinWheel from '@/components/trip/spin-wheel';
import SplitRoulette from '@/components/trip/split-roulette';
import { BrandColors, Spacing, isDarkTheme } from '@/constants/theme';
import { Expense, Settlement } from '@/types/expenses';
import { Trip, TripMember } from '@/types/trips';
import { lastPayerOf, pickRandomPayer, tripAwards, tripCountdown } from '@/utils/fun';
import { formatMoney } from '@/utils/money';
import { ReactNode, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Cake,
  Crown,
  Dices,
  Flame,
  Gift,
  Medal,
  PartyPopper,
  Sparkles,
  Trophy,
  Wallet,
} from 'lucide-react-native';
import { Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface FunTabProps {
  trip: Trip;
  members: TripMember[];
  expenses: Expense[];
  settlements: Settlement[];
  currency: string;
  currentUserId: string;
  /** Today, as YYYY-MM-DD, so the countdown is settled at render time. */
  today: string;
  /** Called when the wheel picks who pays next. */
  onPickPayer?: (member: TripMember) => void;
  /** True once the trip is over, which is when the guesses are revealed. */
  tripEnded?: boolean;
  /** Whether this person owns the trip, which lets them remove anyone's song. */
  isOwner?: boolean;
}

/** The colour each award wears, so the row reads as a badge (read when drawn, so it follows the theme). */
const awardLooks = (): Record<string, { icon: typeof Trophy; bg: string; fg: string }> => ({
  sponsor: { icon: Wallet, bg: BrandColors.infoBg, fg: BrandColors.info },
  priciest: { icon: Flame, bg: BrandColors.warningBg, fg: BrandColors.warning },
  streak: {
    icon: Medal,
    bg: BrandColors.base200,
    fg: isDarkTheme() ? BrandColors.onBrand : BrandColors.base700,
  },
  generous: { icon: ArrowLeftRight, bg: BrandColors.successBg, fg: BrandColors.success },
  owl: { icon: Sparkles, bg: BrandColors.inputField, fg: BrandColors.secondary },
});

/**
 * The playful side of a trip: a countdown, awards drawn from what really
 * happened, and a wheel to settle who pays next.
 *
 * Everything on this tab is computed from expenses and members the app already
 * has on the phone, so it works with no connection and costs no extra read.
 * Nothing here changes any money.
 */
export default function FunTab({
  trip,
  members,
  expenses,
  settlements,
  currency,
  currentUserId,
  today,
  onPickPayer,
  tripEnded = false,
  isOwner = false,
}: FunTabProps) {
  const tripId = trip?.id ?? '';
  const spentTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );
  const countdown = useMemo(
    () => tripCountdown(trip.startDate, trip.endDate, today),
    [trip.startDate, trip.endDate, today],
  );

  const awards = useMemo(
    () => tripAwards(members, expenses, settlements, (amount) => formatMoney(amount, currency)),
    [members, expenses, settlements, currency],
  );

  const [picked, setPicked] = useState<TripMember | null>(null);
  const [spinning, setSpinning] = useState(false);

  /* The draw itself. The wheel calls this first, then animates to the answer, so
     the result never comes from wherever the ring happens to stop. */
  const drawPayer = () => pickRandomPayer(members, lastPayerOf(expenses));

  return (
    <View style={styles.wrap}>
      {/* The countdown answers the question a trip months out is really about. */}
      {countdown && countdown.phase !== 'past' && (
        <Card style={styles.countdownCard}>
          <View style={styles.countdownLeft}>
            <Text style={styles.countdownKicker}>
              {countdown.phase === 'live' ? 'Happening now' : 'Counting down'}
            </Text>
            <Text style={styles.countdownValue}>
              {countdown.phase === 'live' && countdown.days === 0
                ? 'Today'
                : countdown.phase === 'live'
                  ? countdown.label
                  : Math.abs(countdown.days)}
            </Text>
            <Text style={styles.countdownHint}>
              {countdown.phase === 'live'
                ? 'Make the most of it.'
                : countdown.label === 'Tomorrow'
                  ? 'Nearly there.'
                  : 'days until this trip starts.'}
            </Text>
          </View>
          <View style={styles.countdownIcon}>
            <Cake size={26} color={BrandColors.base700} />
          </View>
        </Card>
      )}

      <SectionTitle
        right={
          <View style={styles.titleTag}>
            <PartyPopper
              size={11}
              color={isDarkTheme() ? BrandColors.onBrand : BrandColors.base700}
            />
            <Text style={styles.titleTagText}>From your expenses</Text>
          </View>
        }
      >
        Trip awards
      </SectionTitle>

      {awards.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Trophy size={22} color={BrandColors.secondary} />
          <Text style={styles.emptyTitle}>No awards yet</Text>
          <HelperText>
            Add a couple of expenses and the awards start handing themselves out.
          </HelperText>
        </Card>
      ) : (
        <View style={styles.list}>
          {awards.map((award) => {
            const looks = awardLooks();
            const look = looks[award.key] ?? looks.owl;
            const Icon = look.icon;
            return (
              <View key={award.key} style={styles.awardRow}>
                <View style={[styles.awardIcon, { backgroundColor: look.bg }]}>
                  <Icon size={17} color={look.fg} />
                </View>
                <View style={styles.awardBody}>
                  <Text style={styles.awardTitle}>{award.title}</Text>
                  <Text style={styles.awardHolder} numberOfLines={1}>
                    {award.holder}
                  </Text>
                </View>
                <Text style={styles.awardDetail} numberOfLines={1}>
                  {award.detail}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <SectionTitle>Who pays next</SectionTitle>

      <Card style={styles.wheelCard}>
        <View style={styles.wheelHeader}>
          <Dices size={18} color={BrandColors.primary} />
          <Text style={styles.wheelTitle}>
            {spinning
              ? 'Spinning...'
              : picked
                ? `${picked.fullname.split(' ')[0]} pays next`
                : 'Spin to choose'}
          </Text>
        </View>

        <HelperText>
          {picked && !spinning
            ? 'Whoever just paid the last expense is left out, so the wheel never lands on the same person twice.'
            : 'For the next round of drinks or the next round of tolls. Nothing is recorded - this is just to end the argument.'}
        </HelperText>

        <SpinWheel
          members={members}
          spinning={spinning}
          setSpinning={setSpinning}
          draw={drawPayer}
          onSpinStart={() => setPicked(null)}
          onSettle={(member) => {
            setPicked(member);
            onPickPayer?.(member);
          }}
        />
      </Card>

      <SectionTitle>Your trip so far</SectionTitle>

      <View style={styles.tileRow}>
        <Tile
          icon={<Gift size={14} color={BrandColors.secondary} />}
          label="Expenses"
          value={String(expenses.length)}
        />
        <Tile
          icon={<Wallet size={14} color={BrandColors.secondary} />}
          label="Spent"
          value={formatMoney(
            expenses.reduce((sum, expense) => sum + expense.amount, 0),
            currency,
          )}
        />
        <Tile
          icon={<Crown size={14} color={BrandColors.secondary} />}
          label="People"
          value={String(members.length)}
        />
      </View>

      {members.length > 1 && expenses.length > 0 && (
        <HelperText>
          You are {currentUserId ? 'one of' : ''} {members.length} people sharing this trip.
        </HelperText>
      )}

      <SectionTitle>Sounds and games</SectionTitle>

      <SoundtrackCard
        tripId={tripId}
        members={members}
        currentUserId={currentUserId}
        isOwner={isOwner}
      />

      <SplitRoulette members={members} currency={currency} currentUserId={currentUserId} />

      <GuessCard
        tripId={tripId}
        members={members}
        currency={currency}
        currentUserId={currentUserId}
        actual={spentTotal}
        tripEnded={tripEnded}
      />
    </View>
  );
}

function Tile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      {icon}
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: {
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },

  countdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.base400,
    borderColor: BrandColors.base400,
  },
  countdownLeft: {
    flex: 1,
    gap: 1,
  },
  countdownKicker: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: BrandColors.onBrand,
    opacity: 0.7,
  },
  countdownValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 30,
    color: BrandColors.onBrand,
    letterSpacing: -0.5,
  },
  countdownHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.onBrand,
    opacity: 0.75,
  },
  countdownIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.background,
  },

  titleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BrandColors.base200,
    borderRadius: 99,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  titleTagText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 10,
    color: BrandColors.onBrand,
  },

  list: {
    gap: Spacing.two,
  },
  awardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  awardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  awardBody: {
    flex: 1,
    gap: 1,
  },
  awardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.secondary,
    letterSpacing: 0.3,
  },
  awardHolder: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  awardDetail: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
    maxWidth: '42%',
    textAlign: 'right',
  },

  emptyCard: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },

  wheelCard: {
    backgroundColor: BrandColors.surfaceAlt,
    gap: Spacing.two,
  },
  wheelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  wheelTitle: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: 3,
  },
  tileValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  tileLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
}));
