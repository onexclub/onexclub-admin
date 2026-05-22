import {
  Body,
  Button,
  Column,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as styles from "@/emails/gym-email-styles";

export interface GymOwnerWelcomeProps {
  ownerName: string;
  gymName: string;
  outletName: string;
  outletCity: string;
  loginUrl: string;
  planTier: string;
  supportEmail: string;
}

/**
 * Gym owner onboarding — sent from `sendGymOwnerWelcome` in `@/lib/email/send-welcome-emails`.
 * Add templates under `src/emails/` and wire senders beside that module for consistency.
 */
export default function GymOwnerWelcomeEmail({
  ownerName,
  gymName,
  outletName,
  outletCity,
  loginUrl,
  planTier,
  supportEmail,
}: GymOwnerWelcomeProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fallbackFontFamily="Arial"
          fontFamily="Inter"
          fontWeight={400}
          webFont={{
            format: "woff2",
            url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
          }}
        />
      </Head>

      <Preview>
        Welcome to GymOS, {gymName}! Your gym dashboard is ready 🎉
      </Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.headerLogo}>GymOS</Text>
            <Text style={styles.headerTagline}>Gym Management Platform</Text>
          </Section>

          <Section style={styles.hero}>
            <Text style={styles.emoji}>🎉</Text>
            <Heading style={styles.h1}>Welcome aboard, {ownerName}!</Heading>
            <Text style={styles.subtitle}>
              <strong>{gymName}</strong> is now live on GymOS. Your first branch is ready to start onboarding
              members.
            </Text>
          </Section>

          <Section style={styles.card}>
            <Text style={styles.cardLabel}>YOUR FIRST BRANCH</Text>
            <Text style={styles.cardValue}>{outletName}</Text>
            <Text style={styles.cardSub}>{outletCity}</Text>
            <Hr style={styles.cardDivider} />
            <Row>
              <Column>
                <Text style={styles.cardLabel}>PLAN</Text>
                <Text style={styles.cardValue}>{planTier.toUpperCase()}</Text>
              </Column>
              <Column>
                <Text style={styles.cardLabel}>STATUS</Text>
                <Text style={{ ...styles.cardValue, color: "#22c55e" }}>ACTIVE</Text>
              </Column>
            </Row>
          </Section>

          <Section style={styles.stepsSection}>
            <Text style={styles.stepsTitle}>Get started in 3 steps</Text>

            {[
              {
                desc: "Define pricing, duration, and cross-branch access rules.",
                num: "01",
                title: "Set up membership plans",
              },
              {
                desc: "Add receptionists and trainers to your branch.",
                num: "02",
                title: "Invite your staff",
              },
              {
                desc: "Onboard customers via the admin panel or member app.",
                num: "03",
                title: "Start adding members",
              },
            ].map((step) => (
              <Row key={step.num} style={styles.stepRow}>
                <Column style={styles.stepNumCol}>
                  <Text style={styles.stepNum}>{step.num}</Text>
                </Column>
                <Column style={styles.stepTextCol}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </Column>
              </Row>
            ))}
          </Section>

          <Section style={styles.ctaSection}>
            <Button href={loginUrl} style={styles.ctaButton}>
              Open Your Dashboard →
            </Button>
          </Section>

          <Hr style={styles.divider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Questions? Reply to this email or write to{" "}
              <a href={`mailto:${supportEmail}`} style={styles.link}>
                {supportEmail}
              </a>
            </Text>
            <Text style={styles.footerMuted}>
              GymOS Platform · This email was sent because your gym was onboarded on our platform.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
