import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as styles from "@/emails/gym-email-styles";
import * as brand from "@/emails/onex-email-brand";

export interface CustomerWelcomeProps {
  memberName: string;
  gymName: string;
  outletName: string;
  outletCity: string;
  planName: string;
  startDate: string;
  endDate: string | null;
  trainerName: string | null;
  gymPhone: string | null;
  memberPhone: string | null;
  /** Absolute URL — `/brand/logo-wordmark.png` on the admin app origin. */
  brandLogoUrl: string;
  /** Public marketing site — defaults to https://onexclub.in */
  websiteUrl?: string;
}

/**
 * Customer welcome — sent when gym staff finish onboarding (`sendCustomerWelcomeAfterGymOnboard`).
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
  gymPhone,
  memberPhone,
  brandLogoUrl,
  websiteUrl = brand.ONEX_WEBSITE_URL,
}: CustomerWelcomeProps) {
  const websiteHost = websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

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

      <Preview>You&apos;re in! Welcome to {gymName} — your membership is active</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ background: brand.accentBar, height: "4px", margin: 0, padding: 0 }} />

          <Section style={{ ...styles.header, background: brand.headerGradient, padding: "28px 40px 24px" }}>
            <Img
              src={brandLogoUrl}
              alt="ONE X CLUB"
              height={40}
              style={{ display: "block", margin: "0 auto 12px", maxWidth: "200px" }}
            />
            <Text
              style={{
                color: brand.colors.accent,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "2px",
                margin: "0 0 6px",
                textAlign: "center" as const,
                textTransform: "uppercase" as const,
              }}
            >
              ONE X CLUB
            </Text>
            <Text style={{ ...styles.headerTagline, color: "#a1a1aa", margin: 0 }}>
              {gymName} · {outletName}, {outletCity}
            </Text>
          </Section>

          <Section style={styles.hero}>
            <Text
              style={{
                backgroundColor: brand.colors.primarySoft,
                borderRadius: "999px",
                color: brand.colors.primary,
                display: "inline-block",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1.2px",
                margin: "0 0 16px",
                padding: "6px 14px",
                textTransform: "uppercase" as const,
              }}
            >
              Membership active
            </Text>
            <Heading style={{ ...styles.h1, color: brand.colors.ink }}>Welcome, {memberName}!</Heading>
            <Text style={styles.subtitle}>
              You&apos;re officially part of <strong>{gymName}</strong>. Your membership is live — we&apos;re glad
              you&apos;re here.
            </Text>
          </Section>

          <Section
            style={{
              ...styles.card,
              background: brand.planCardGradient,
              border: "none",
              margin: "0 40px 32px",
            }}
          >
            <Text style={{ ...styles.cardLabel, color: "#fdba74" }}>YOUR PLAN</Text>
            <Text style={{ ...styles.cardValue, color: brand.colors.white, fontSize: "22px" }}>{planName}</Text>
            <Hr style={{ ...styles.cardDivider, borderColor: "#9a3412" }} />
            <Row>
              <Column>
                <Text style={{ ...styles.cardLabel, color: "#fed7aa" }}>STARTS</Text>
                <Text style={{ ...styles.cardValue, color: brand.colors.white }}>{startDate}</Text>
              </Column>
              {endDate ? (
                <Column>
                  <Text style={{ ...styles.cardLabel, color: "#fed7aa" }}>VALID UNTIL</Text>
                  <Text style={{ ...styles.cardValue, color: brand.colors.white }}>{endDate}</Text>
                </Column>
              ) : null}
              {trainerName ? (
                <Column>
                  <Text style={{ ...styles.cardLabel, color: "#fed7aa" }}>COACH</Text>
                  <Text style={{ ...styles.cardValue, color: brand.colors.white }}>{trainerName}</Text>
                </Column>
              ) : null}
            </Row>
          </Section>

          <Section style={styles.stepsSection}>
            <Text style={{ ...styles.stepsTitle, color: brand.colors.ink }}>What&apos;s coming next</Text>
            <Text
              style={{
                color: brand.colors.inkMuted,
                fontSize: "14px",
                lineHeight: "22px",
                margin: "0 0 20px",
              }}
            >
              Our member app is <strong>coming soon</strong>. When it launches, you&apos;ll sign in with your registered
              mobile number{memberPhone ? ` (${memberPhone})` : ""} and get everything in one place:
            </Text>

            {[
              "Track workouts, membership, and progress",
              "View your personalised diet and exercise plans",
              "Book slots, log weights, and stay on schedule",
              "Explore club updates, facilities, and more",
            ].map((item) => (
              <Text
                key={item}
                style={{
                  color: brand.colors.inkMuted,
                  fontSize: "14px",
                  lineHeight: "22px",
                  margin: "0 0 10px",
                  paddingLeft: "4px",
                }}
              >
                <span style={{ color: brand.colors.primary, fontWeight: 700, marginRight: "8px" }}>•</span>
                {item}
              </Text>
            ))}

            <Section
              style={{
                backgroundColor: brand.colors.primarySoft,
                border: `1px solid #fed7aa`,
                borderRadius: "12px",
                marginTop: "24px",
                padding: "16px 20px",
              }}
            >
              <Text style={{ color: brand.colors.ink, fontSize: "14px", fontWeight: 600, margin: "0 0 6px" }}>
                Visit us online
              </Text>
              <Text style={{ color: brand.colors.subtle, fontSize: "13px", lineHeight: "20px", margin: 0 }}>
                Learn more about {gymName} at{" "}
                <Link href={websiteUrl} style={{ color: brand.colors.primary, fontWeight: 600, textDecoration: "none" }}>
                  {websiteHost}
                </Link>
                .
              </Text>
            </Section>
          </Section>

          {gymPhone ? (
            <Section style={{ padding: "0 40px 24px", textAlign: "center" as const }}>
              <Text style={{ color: brand.colors.subtle, fontSize: "13px", margin: 0 }}>
                Questions? Call {outletName} at{" "}
                <Link href={`tel:${gymPhone}`} style={{ ...styles.link, color: brand.colors.primary }}>
                  {gymPhone}
                </Link>
              </Text>
            </Section>
          ) : null}

          <Hr style={styles.divider} />
          <Section style={{ ...styles.footer, backgroundColor: brand.colors.surface }}>
            <Text style={styles.footerText}>
              {gymName} · {outletName}, {outletCity}
            </Text>
            <Text style={styles.footerMuted}>
              You received this because {gymName} added you as a member. Welcome aboard!
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
