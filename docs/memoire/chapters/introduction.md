# General Introduction

The widespread use of the Internet has made the protection of online communications a daily concern for individuals and organisations alike. Public and untrusted networks expose users to interception, tracking and censorship, while remote work and the use of online services from any location increase the need to reach resources privately and securely. The **Virtual Private Network (VPN)** has become one of the most common answers to this need: it wraps a user's traffic in an encrypted tunnel so that it stays confidential and its origin is hidden from the networks it crosses. Around this technology a large commercial market has formed, in which providers sell VPN access as a subscription service to a worldwide audience.

In parallel, **electronic commerce** has become a normal way of buying and selling services. In Algeria, this evolution is framed by a dedicated legal basis — Law 18-05 of 10 May 2018 on electronic commerce — and is supported by national payment instruments, the **EDAHABIA** card of Algérie Poste and the interbank **CIB** card, which make it possible to pay online in Algerian dinars (DZD) without a foreign card or a foreign currency. Payment gateways such as **Chargily** now connect these instruments to web applications, so that a local business can collect payments online. The protection of the personal data handled by such services is in turn governed by Law 18-07 of 10 June 2018, amended in 2025 by Law 25-11.

This context defines both an opportunity and a problem. Selling and delivering a digital service such as a VPN requires, beyond the VPN technology itself, a complete commercial chain: presenting offers, letting a customer subscribe and pay online in dinars, provisioning the service automatically, and keeping the whole process secure and traceable. For an organisation that still relies on a manual, paper-based or e-mail-based process, this chain is slow, hard to track and closed to self-service.

The present end-of-training thesis is carried out as a case study within **«Entreprise d'Appui au Développement du Numérique (EADN)» — PLACEHOLDER: EADN's exact activity, services and current process are collected during the internship and presented in Chapter I.** It proposes and builds **NexusVPN**, a web portal that sells and provisions a VPN service online for the Algerian market.

## Objectives of the project

The objective of this work is to design and develop a secure web portal that covers the commercialisation and the provisioning of a VPN service end to end. Concretely, the portal aims to:

- present the VPN offers (subscription plans in Algerian dinars) on a public site;
- let a customer register, start a free trial, and subscribe and pay online with EDAHABIA or CIB through the Chargily gateway;
- provision VPN access automatically by generating the cryptographic material (WireGuard key pair) and delivering a ready-to-import configuration file;
- give an administrator a back-office to manage offers, subscriptions, payments and refunds, moderate customer feedback, handle sales enquiries and consult an audit trail;
- apply the security and data-protection measures expected of an e-commerce application, while being explicit about what depends on a production deployment that is outside the scope of this work.

## Method followed

The work follows the methodology required for the BTS thesis and the structure agreed with the supervisor. It begins with the study of the host organisation and its existing system (Chapter I), continues with the theoretical background needed to understand the problem (Chapter II), then moves to the analysis and design of the solution using the Unified Modeling Language (Chapter III), and finally to its implementation, testing and deployment (Chapter IV). Throughout, the design is grounded in the real, working application rather than in an idealised specification.

## Structure of the thesis

The thesis is organised into four chapters:

- **Chapter I — Presentation of the host organisation (EADN):** the organisation, its departments, its existing service-sales process, the documents it uses, and a critique that motivates the project. *(This chapter is written from the information collected during the internship — PLACEHOLDER.)*
- **Chapter II — Overview of VPN services and e-commerce:** the fundamentals of VPNs and their protocols (IPsec, OpenVPN, WireGuard), the types of VPN service, security and data-protection frameworks, and the concepts of electronic commerce and online payment in the Algerian context.
- **Chapter III — System analysis and design:** the requirements, the actors and their roles, the use cases, and the UML models (use-case, sequence and class diagrams, relational model and data dictionary) that describe the solution.
- **Chapter IV — Implementation and deployment:** the technologies used, the software architecture, the functional modules, a walk-through of the interface, the critical components shown with code excerpts, the quality-assurance work, and the planned production environment.

A general conclusion then summarises the results, answers the problem statement, states the value and the limits of the work, and opens on perspectives for its continuation.
