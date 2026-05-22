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

export interface CustomerWelcomeProps {
  memberName: string;
  gymName: string;
  outletName: string;
  outletCity: string;
  planName: string;
  startDate: string;
  endDate: string | null;
  trainerName: string | null;
  appDownloadUrl: string;
  gymPhone: string | null;
}

/**
 * Customer welcome — typically triggered after Auth email verification (see `sendCustomerWelcome`).
 */
export default function CustomerWelcomeEmail({
  memberName,
  gymName,
  outletName,
  outletCity,
  planName,
  startDate,
  endDate,
  trainerName,
  appDownloadUrl,
  gymPhone,
}: CustomerWelcomeProps) {
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

      <Preview>You're in! Welcome to {gymName} 💪 Your membership is active.</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section
            style={{
              ...styles.header,
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            }}
          >
            <Text style={styles.headerLogo}>{gymName}</Text>
            <Text style={styles.headerTagline}>
              {outletName} · {outletCity}
            </Text>
          </Section>

          <Section style={styles.hero}>
            <Text style={styles.emoji}>💪</Text>
            <Heading style={styles.h1}>Welcome, {memberName}!</Heading>
            <Text style={styles.subtitle}>
              Your membership at <strong>{gymName}</strong> is now active. Let&apos;s make every session count.
            </Text>
          </Section>

          <Section
            style={{
              ...styles.card,
              background: "linear-gradient(135deg, #1a1a2e 0%, #312e81 100%)",
            }}
          >
            <Text style={{ ...styles.cardLabel, color: "#a5b4fc" }}>YOUR MEMBERSHIP</Text>
            <Text style={{ ...styles.cardValue, color: "#fff", fontSize: "22px" }}>{planName}</Text>
            <Hr style={{ ...styles.cardDivider, borderColor: "#4338ca" }} />
            <Row>
              <Column>
                <Text style={{ ...styles.cardLabel, color: "#818cf8" }}>ACTIVE FROM</Text>
                <Text style={{ ...styles.cardValue, color: "#fff" }}>{startDate}</Text>
              </Column>
              {endDate ? (
                <Column>
                  <Text style={{ ...styles.cardLabel, color: "#818cf8" }}>VALID UNTIL</Text>
                  <Text style={{ ...styles.cardValue, color: "#fff" }}>{endDate}</Text>
                </Column>
              ) : null}
              {trainerName ? (
                <Column>
                  <Text style={{ ...styles.cardLabel, color: "#818cf8" }}>YOUR TRAINER</Text>
                  <Text style={{ ...styles.cardValue, color: "#fff" }}>{trainerName}</Text>
                </Column>
              ) : null}
            </Row>
          </Section>

          <Section style={styles.stepsSection}>
            <Text style={styles.stepsTitle}>What you can do in the app</Text>
            {[
              { icon: "📋", text: "Complete your health profile — helps your trainer understand you better" },
              { icon: "📅", text: "Book workout slots and classes at your branch" },
              { icon: "🥗", text: "View your personalised diet and exercise plans" },
              { icon: "📊", text: "Track your progress — weight, BMI, body metrics" },
            ].map((item) => (
              <Text key={item.icon} style={styles.featureRow}>
                <span style={{ marginRight: "10px" }}>{item.icon}</span>
                {item.text}
              </Text>
            ))}
          </Section>

          <Section style={styles.ctaSection}>
            <Text
              style={{
                ...styles.stepsTitle,
                marginBottom: "16px",
                textAlign: "center" as const,
              }}
            >
              Download the app to get started
            </Text>
            <Button href={appDownloadUrl} style={styles.ctaButton}>
              Download the App →
            </Button>
          </Section>

          {gymPhone ? (
            <Section style={{ padding: "0 40px 24px", textAlign: "center" as const }}>
              <Text style={{ color: "#71717a", fontSize: "13px", margin: 0 }}>
                Need help? Call your gym at{" "}
                <a href={`tel:${gymPhone}`} style={styles.link}>
                  {gymPhone}
                </a>
              </Text>
            </Section>
          ) : null}

          <Hr style={styles.divider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              {gymName} · {outletName}, {outletCity}
            </Text>
            <Text style={styles.footerMuted}>
              You received this because you joined {gymName}. This is your only welcome email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
