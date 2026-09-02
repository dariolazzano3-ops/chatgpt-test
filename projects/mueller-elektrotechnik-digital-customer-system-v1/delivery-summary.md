# Müller Elektrotechnik — Digital Customer System V1

## Customer

Müller Elektrotechnik is a fully synthetic quality-test business representing a local electrical contractor in Saarbrücken, Germany. It is not presented as a real company or customer.

## Customer problem

The assumed starting point is a small-to-medium local electrical contractor receiving most enquiries by phone and email, with an outdated or insufficient website, no structured lead capture, no consistent CRM process, manual follow-up and no end-to-end analytics view.

## System built

AURENTARA produced one coherent synthetic customer system using the existing project, preflight, Web, Business/CRM, Automation and QA contracts. The project covers the customer journey from service discovery through qualified enquiry, CRM progression, follow-up logic and conversion measurement design.

## Website

A private, noindex website prototype was built for Saarbrücken-focused electrical services. It includes a strong service-led hero, six service areas, transparent project-start steps, regional positioning, a clear CTA system, responsive navigation, an enquiry section and a synthetic-company disclosure. No reviews, awards, master-craftsman title, customer counts, prices or availability promises were invented.

## Lead flow

The enquiry flow asks only for the information needed to make a useful first classification: name, contact method, postal code and project type, with timeframe and a short message optional. The test validates the form locally in the browser and performs no external write.

## CRM

The synthetic CRM design uses the pipeline: NEW INQUIRY → QUALIFICATION → CONTACTED → SITE VISIT / DETAILS → QUOTE → FOLLOW-UP → WON / LOST. It tracks project type, contact channel, postal code, timeframe, next action, due date and a loss reason where relevant.

## Automation

The follow-up design covers enquiry intake, required-field validation, classification, confirmation preparation, CRM lead creation, an internal next action, unanswered-enquiry follow-up and quote follow-up. The existing Automation Factory dry run blocks the email and CRM-write steps, so no message or customer record is sent externally.

## Analytics

The design defines PAGE_VIEW, PRIMARY_CTA_CLICK, CONTACT_START, CONTACT_SUBMIT, SERVICE_INTEREST, PHONE_CLICK and EMAIL_CLICK. The event model excludes names, email addresses, phone numbers and free-text messages. No analytics event is emitted externally in this test.

## QA

The final private browser acceptance passed at 1440×1000 desktop, 768×900 tablet, 390×844 mobile and 320×760 mobile-small. The run checks responsive overflow, navigation, 44px mobile controls, Escape/focus behavior, form labels, local form validation, noindex, console errors and external requests. A first responsive defect was found during QA and repaired before final acceptance.

## Commercial quality

Final overall commercial-quality score: **8.5 / 10**. The output is considered chargeable as a professionally designed customer system and private customer-ready preview. This does not claim production launch readiness.

## Limitations

The synthetic run intentionally cannot provide real customer trust evidence such as team/project photography, verified qualifications, reviews, contact/legal details or documented past work. External CRM writes, customer messages, analytics events, production deployment and public deployment are also intentionally not activated.

## Next step for a real customer

The highest-value next step would be customer onboarding of verified trust assets and business details, followed by separately approved activation of the already designed lead, CRM, follow-up and analytics integrations. This Phase 2 run does not perform those launch actions.

## Safety

Production OFF. Public deploy OFF. Real customer data NONE. Real customer AI processing OFF. Billing OFF. Paid provider calls 0. External customer writes 0. Additional variable test cost €0.
