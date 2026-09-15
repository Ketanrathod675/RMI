import { dark, primary } from "@/constants/Colors";
import { useDefault } from "@/hooks/useDefault";
import { height } from "@/utils/dimensions";
import React, { type Dispatch, type FC, type SetStateAction, useCallback } from "react";
import {
	Linking,
	Modal,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

interface PrivacyPolicyProps {
	showModal: boolean;
	setShowModal: Dispatch<SetStateAction<boolean>>;
}

export const PrivacyPolicy: FC<PrivacyPolicyProps> = ({ showModal, setShowModal }) => {
	const { language } = useDefault();

	const handleClose = useCallback(() => {
		setShowModal(false);
	}, [setShowModal]);

	// Handle back button press via Modal's onRequestClose prop

	return (
		<Modal
			visible={showModal}
			transparent={true}
			animationType="fade"
			onRequestClose={handleClose}>
			<View style={styles.backdrop}>
				{language === "english" && (
					<SafeAreaView style={styles.container}>
						<View style={styles.modalContent}>
							{/* Header */}
							<View style={styles.header}>
								<Text style={styles.title}>Privacy Policy</Text>
							</View>

							{/* Scrollable Content */}
							<ScrollView
								style={styles.scrollContainer}
								showsVerticalScrollIndicator={true}>
								<View style={styles.content}>
									<Text style={styles.paragraph}>
										We, at RapidMoney. ("MoneyTime Technology Solutions Pvt Ltd"
										or "We") understand Privacy and its value. Therefore, it is
										all the more important for us to make You ("You" or
										"Customer" or "User"), the User of the website
										www.rapidmoney.in (the "Website") and its associated mobile
										applications, MoneyTime Technology Solutions Pvt Ltd
										("Application" or "App") (collectively, the "Platform")
										understand the reason behind collection of your information
										and its usage and the manner in which we collect, use, store
										and share information about you ("Privacy Policy").
									</Text>

									<Text style={styles.paragraph}>
										This Privacy Policy has been prepared in compliance with:
									</Text>

									<Text style={styles.listItem}>
										a. Information Technology (Reasonable Security Practices and
										Procedures and Sensitive Personal Data or Information)
										Rules, 2011;
									</Text>
									<Text style={styles.listItem}>
										b. Information Technology (Intermediary Guidelines and
										Digital Media Ethics Code) Rules, 2021
									</Text>
									<Text style={styles.listItem}>
										c. Guidelines on Digital Lending issued by the Reserve Bank
										of India (RBI), 2025;
									</Text>
									<Text style={styles.listItem}>
										d. Other applicable acts, regulations and rules which
										require the publishing of a privacy policy for handling of
										or dealing in personal information including sensitive
										personal data or information and all applicable laws,
										regulations, guidelines provided by applicable regulatory
										authorities including but not limited to the RBI.
									</Text>

									<Text style={styles.sectionTitle}>CONSENT</Text>
									<Text style={styles.paragraph}>
										You hereby expressly consent to provide the information that
										may be required in relation to the Services (as defined
										below) being rendered on the Platform by us. You acknowledge
										that we shall collect the information detailed under this
										Privacy Policy to facilitate lending & non-lending services
										by partnering with various financial lenders, third parties,
										service providers, etc based on your requirement to avail
										such Services ("Services").
									</Text>
									<Text style={styles.paragraph}>
										MoneyTime Technology Solutions Pvt Ltd will only be using
										the information for providing the Services to you.
									</Text>
									<Text style={styles.paragraph}>
										In order to avail any Services being provided by MoneyTime
										Technology Solutions Pvt Ltd by itself or in partnership
										with the lenders or other third parties it is important that
										YOU READ, UNDERSTAND, ACKNOWLEDGE AND UNCONDITIONALLY AGREE
										TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS PRIVACY
										POLICY.
									</Text>
									<Text style={styles.paragraph}>
										IF YOU DO NOT AGREE TO THIS POLICY OR ANY PART THEREOF,
										PLEASE DO NOT USE/ ACCESS/ DOWNLOAD/ INSTALL THE PLATFORM OR
										ANY PART THEREOF.
									</Text>
									<Text style={styles.paragraph}>
										For the users consenting to continue accessing the Platform
										and avail the Services, this Privacy Policy explains our
										policies and practices regarding the collection, use, and
										disclosure of Your information.
									</Text>

									<Text style={styles.sectionTitle}>
										COLLECTION OF INFORMATION
									</Text>
									<Text style={styles.paragraph}>
										The collection of information under this Privacy Policy are
										conducted for the following categories of services:
									</Text>
									<Text style={styles.paragraph}>
										Part A: Information for Digital Lending Services:
										Information collected by Platform for facilitation of Loans
										being disbursed by the financial lending partners whose
										details are available on the Website and the Application and
										who are registered with the Reserve Bank of India ("Lending
										Partners").
									</Text>
									<Text style={styles.paragraph}>
										Part B: Information for Non-Lending Services: Information
										collected by Platform while registering a User on the
										Platform or while providing Value Added Services (i.e. all
										services other than facilitation of loans).
									</Text>

									<Text style={styles.subSectionTitle}>
										A. Information we collect about you
									</Text>
									<Text style={styles.paragraph}>
										In order to facilitate the lending and non-lending services,
										MoneyTime Technology Solutions Pvt Ltd will be required to
										access, collect and share Personal Information with its
										lending partners that may be banks or NBFCs registered with
										the Reserve Bank of India or any other third-party providing
										value added services in partnership with MoneyTime
										Technology Solutions Pvt Ltd. In such cases, MoneyTime
										Technology Solutions Pvt Ltd will share the information
										securely and ensure that all personal information recipients
										comply with confidentiality, fidelity and secrecy
										obligations and sign covenants in this regard. MoneyTime
										Technology Solutions Pvt Ltd may make information available
										to third parties that are financial and non-financial
										companies, government agencies, courts, legal investigators,
										and other non-affiliated third parties as requested by You
										or Your authorized representative, or otherwise when
										required or permitted by law.
									</Text>

									<Text style={styles.listTitle}>
										1. User Personal Information:
									</Text>
									<Text style={styles.paragraph}>
										The data points we collect from You for both lending and
										non-lending services include, inter alia, your full name,
										email id, PAN, GST Network user id & password, address,
										mobile number, postal code.
									</Text>

									<Text style={styles.listTitle}>
										2. Social Account Information:
									</Text>
									<Text style={styles.paragraph}>
										MoneyTime Technology Solutions Pvt Ltd may provide you with
										the option to register using social accounts (Google) to
										access the app and shall collect only such registered email
										id and user public profile information like name, email
										depending on the platform used by You to log-into the
										Application during registration/ sign in process in the
										Platform. How we use this information: We may collect and
										store email id, name and address associated with that
										account for the purpose of verification and to pre-populate
										relevant fields in the course of Platform interface.
										However, we shall not collect / store account passwords.
									</Text>

									<Text style={styles.listTitle}>3. SMS Information:</Text>
									<Text style={styles.paragraph}>
										MoneyTime Technology Solutions Pvt Ltd doesn't collect, read
										or store personal SMS from your Inbox. We collect and
										monitor only financial transactional SMS, such as, bank
										related transactions, the names of the transacting parties,
										a description of the transaction and the amount of the
										transaction for the purpose of performing credit risk
										assessment. We monitor only SMS sent by 6 - digit
										alphanumeric senders. How we use this information: We use
										this data to provide you with updates or confirmation of any
										actions taken in our Platform during the term of Services.
										We shall collect SMS information related to financial
										transactions for facilitating your lending and non-lending
										service including such purposes as may be required by the
										Lending Partners or as per applicable law. This category of
										information is only collected for providing the non-lending
										services or our value-added services.
									</Text>

									<Text style={styles.listTitle}>
										4. Device Information and Installed Apps data:
									</Text>
									<Text style={styles.paragraph}>
										We additionally collect certain device information provided
										herein for our lending and non-lending services. Information
										which the Application collects, and its usage, depends on
										how you manage your privacy controls on your device.
									</Text>

									<Text style={styles.subListTitle}>(i) Device Information:</Text>
									<Text style={styles.paragraph}>
										When you install the Application, we store the information
										we collect with unique identifiers tied to the device you
										are using. We collect information from the device when you
										download and install the Application and explicitly seek
										permissions from You to get the required information from
										the device. Additionally, we also collect your Log
										information (via the domain server through which the User
										accesses the App Search queries, IP address, crashes, date
										etc for the purpose of improvising the Application
										functionality. In addition to the above, we also track and
										collect the data related to the performance of the
										Application and other diagnostic data for identifying and
										resolving any technical glitches that may be identified from
										such data and also for improving the overall functionality
										of the Application. How we use the information: We collect
										information about your device to provide automatic updates
										and additional security so that your account is not used in
										other people's devices. In addition, the information
										provides us valuable feedback on your identity as a device
										holder as well as your device behaviour, thereby allowing us
										to improve our products interaction, quality of services and
										provide an enhanced customized user experience to you. We
										further collect other identifiable information such as your
										transactions history on the Platform when you set up a free
										account with us.
									</Text>

									<Text style={styles.subListTitle}>
										(ii) Installed Application Data:
									</Text>
									<Text style={styles.paragraph}>
										We collect and transmit a list of specific installed
										applications' metadata information which includes the
										application name, package name, installed time, updated
										time, version name and version code of each installed
										application on your device. This data may be collected even
										when the app is closed or not in use. How we use this
										information: We use this information for your onboarding and
										Know Your Customer (KYC) purpose with your explicit consent.
									</Text>

									<Text style={styles.listTitle}>
										5. Location, Camera, Microphone Access:
									</Text>
									<Text style={styles.paragraph}>
										We will collect your device location and request camera and
										microphone access for facilitating lending services as well
										as providing any non-lending services only in accordance
										with applicable laws. How we use this information: We shall
										collect your device location information for verifying your
										address, for the KYC and onboarding process for the
										Services. We may request camera access to capture your image
										for identity verification required for processing loan and
										as per the instructions of our Lending Partners in
										accordance with applicable laws. We shall transfer such
										information to our Lending Partners and shall not store any
										such data. We require microphone permissions to enable a
										two-way communication between our authorised agents and you
										for the purpose of performing and completing your Video KYC
										for the Lending Services. Your audio shall be recorded for
										regulatory purposes.
									</Text>

									<Text style={styles.subSectionTitle}>
										B. Information about you we collect from third parties
									</Text>
									<Text style={styles.paragraph}>
										For making the Services available to you, we may collect
										credit information by obtaining specific authorisations from
										you (if required under applicable laws), from certain third
										parties such as credit bureaus or credit rating companies as
										your 'authorised representative' from time to time in
										accordance with applicable laws during the loan journey as
										may be requested by our Lending Partners.
									</Text>
									<Text style={styles.paragraph}>
										In order to facilitate credit products to you, we may
										receive certain information pertaining to document
										verification, etc from certain third parties including NSDL,
										and payment gateway providers.
									</Text>
									<Text style={styles.paragraph}>
										We may further collect your GST details from the Official
										GSTIN API stack or other relevant websites using the GST
										Network user id and password details or OTP as provided by
										you.
									</Text>
									<Text style={styles.paragraph}>
										We may further collect your bank account numbers or UPI
										information on behalf of our lending partners to facilitate
										collection of loans.
									</Text>
									<Text style={styles.paragraph}>
										We shall only collect this information on a need basis
										strictly for the purpose of providing you with the Services.
										The information collected from such third parties is not
										retained by us. We collect this information as part of our
										outsourcing obligations to our Lending Partners and is
										directly transferred to the Lending Partners upon
										collection.
									</Text>

									<Text style={styles.sectionTitle}>GRIEVANCE REDRESSAL</Text>
									<Text style={styles.paragraph}>
										You may make a request for deleting any information from the
										Platform at any stage upon making a request to Us in the
										following manner:
									</Text>
									<Text style={styles.paragraph}>Grievance Officer</Text>
									<Text style={styles.paragraph}>
										In accordance with Information Technology Act 2000 and rules
										made there under, the name and contact details of the
										Grievance Officer are provided below for your reference:
									</Text>
									<Text style={styles.paragraph}>Name: Mr. Amit Agashe</Text>
									<Text style={styles.paragraph}>
										Corporate & Registered Address: 902, 9th floor, Shubhjivan
										Building, Opp Moksh Plaza, Borivali West, Mumbai,
										Maharashtra 400067
									</Text>
									<Text style={styles.paragraph}>
										Email:{" "}
										<Text
											style={styles.emailLink}
											onPress={() => Linking.openURL("mailto:grievance@rapidmoney.in")}>
											grievance@rapidmoney.in
										</Text>
									</Text>
									<Text style={styles.paragraph}>Contact: +91 8097880793</Text>
									<Text style={styles.paragraph}>
										Time: Mon - Sat (10:00am - 7:00pm)
									</Text>

									{/* Add some bottom padding for better scrolling */}
									<View style={styles.bottomPadding} />
								</View>
							</ScrollView>

							{/* Fixed Close Button */}
							<View style={styles.buttonContainer}>
								<TouchableOpacity style={styles.closeButton} onPress={handleClose}>
									<Text style={styles.closeButtonText}>Okay</Text>
								</TouchableOpacity>
							</View>
						</View>
					</SafeAreaView>
				)}

				{language === "hindi" && (
					<SafeAreaView style={styles.container}>
						<View style={styles.modalContent}>
							{/* Header */}
							<View style={styles.header}>
								<Text style={styles.title}>गोपनीयता नीति (Privacy Policy)</Text>
							</View>

							{/* Scrollable Content */}
							<ScrollView
								style={styles.scrollContainer}
								showsVerticalScrollIndicator={true}>
								<View style={styles.content}>
									{/* 1. प्रस्तावना */}
									<Text style={styles.sectionTitle}>1. प्रस्तावना</Text>
									<Text style={styles.paragraph}>
										हम, RapidMoney (MoneyTime Technology Solutions Pvt Ltd),
										आपकी निजता का महत्व समझते हैं। इसलिए यह आवश्यक है कि आप
										(User / Customer) यह जानें कि आपकी जानकारी क्यों एकत्रित की
										जाती है, इसका उपयोग कैसे होता है, और हम इसे कैसे संग्रहीत और
										साझा करते हैं। यह नीति निम्न का पालन करते हुए तैयार की गई
										है:
									</Text>

									<Text style={styles.listItem}>
										• Information Technology (Reasonable Security Practices and
										Procedures and Sensitive Personal Data or Information)
										Rules, 2011
									</Text>
									<Text style={styles.listItem}>
										• Information Technology (Intermediary Guidelines and
										Digital Media Ethics Code) Rules, 2021
									</Text>
									<Text style={styles.listItem}>
										• RBI द्वारा जारी डिजिटल लेंडिंग दिशानिर्देश 2025
									</Text>
									<Text style={styles.listItem}>
										• अन्य सभी लागू कानून, विनियम और दिशानिर्देश
									</Text>

									{/* 2. सहमति */}
									<Text style={styles.sectionTitle}>2. सहमति (Consent)</Text>
									<Text style={styles.paragraph}>
										1. आप स्पष्ट रूप से सहमति देते हैं कि हमें उन सेवाओं
										(Services) से संबंधित जानकारी प्रदान करने की आवश्यकता हो
										सकती है, जिन्हें हम विभिन्न वित्तीय लेंडर्स, तृतीय-पक्ष सेवा
										प्रदाताओं आदि के साथ साझेदारी में प्रदान करते हैं।
									</Text>
									<Text style={styles.paragraph}>
										2. MoneyTime Technology Solutions Pvt Ltd केवल आपकी सेवाएं
										प्रदान करने के लिए ही आपकी जानकारी का उपयोग करेगा।
									</Text>
									<Text style={styles.paragraph}>
										3. सेवाएं प्राप्त करने के लिए आवश्यक है कि आप इस नीति को
										पढ़ें, समझें और इसे बिना शर्त सहमत हों।
									</Text>
									<Text style={styles.paragraph}>
										4. यदि आप इससे सहमत नहीं हैं, तो कृपया इस प्लेटफॉर्म/ऐप का
										उपयोग, डाउनलोड या इंस्टॉलेशन न करें।
									</Text>
									<Text style={styles.paragraph}>
										5. इस नीति के माध्यम से हम आपकी जानकारी के संग्रहण, उपयोग और
										प्रकटीकरण की हमारी नीतियों और प्रक्रियाओं को स्पष्ट करते
										हैं।
									</Text>

									{/* 3. जानकारी का संग्रह */}
									<Text style={styles.sectionTitle}>
										3. जानकारी का संग्रह (Collection of Information)
									</Text>

									<Text style={styles.subSectionTitle}>3.1 सेवाओं के प्रकार</Text>
									<Text style={styles.listItem}>
										• डिजिटल लेंडिंग सेवाएं: उन लेंडर्स (बैंकों या NBFCs) द्वारा
										ऋण सुविधा के लिए एकत्र की जाने वाली जानकारी, जो RBI के
										अंतर्गत पंजीकृत हैं।
									</Text>
									<Text style={styles.listItem}>
										• नॉन-लेंडिंग सेवाएं: प्लेटफॉर्म पर पंजीकरण या वैल्यू-एडेड
										सेवाएं प्रदान करने के दौरान एकत्रित जानकारी।
									</Text>

									<Text style={styles.subSectionTitle}>
										3.2 हम आपसे कौन-सी जानकारी एकत्र करते हैं
									</Text>
									<Text style={styles.listTitle}>• व्यक्तिगत जानकारी:</Text>
									<Text style={[styles.paragraph, { paddingLeft: 20 }]}>
										नाम, ईमेल, PAN, GST Network user ID एवं पासवर्ड, पता, मोबाइल
										नंबर, पिन कोड आदि।
									</Text>

									<Text style={styles.listTitle}>• सोशल अकाउंट जानकारी:</Text>
									<Text style={[styles.paragraph, { paddingLeft: 20 }]}>
										Google जैसे सोशल अकाउंट का उपयोग करके पंजीकरण की स्थिति में
										ईमेल और प्रोफाइल जानकारी (पासवर्ड नहीं) एकत्रित की जाती है।
									</Text>

									<Text style={styles.listTitle}>• SMS जानकारी:</Text>
									<Text style={[styles.paragraph, { paddingLeft: 20 }]}>
										केवल वित्तीय लेनदेन संबंधी SMS (6-अंकीय अल्फान्यूमेरिक
										प्रेषक से) संग्रहीत होती हैं; व्यक्तिगत SMS नहीं पढ़ा या
										संग्रहीत किया जाता है।
									</Text>

									<Text style={styles.listTitle}>
										• डिवाइस और इंस्टॉल ऐप्स की जानकारी:
									</Text>
									<Text style={[styles.subListTitle, { paddingLeft: 20 }]}>
										◦ डिवाइस जानकारी:
									</Text>
									<Text style={[styles.paragraph, { paddingLeft: 40 }]}>
										जैसे लॉग सूचना, IP पता, क्रैश विवरण आदि — ऐप की कार्यक्षमता
										सुधारने के लिए।
									</Text>
									<Text style={[styles.subListTitle, { paddingLeft: 20 }]}>
										◦ इंस्टॉल ऐप्स डेटा:
									</Text>
									<Text style={[styles.paragraph, { paddingLeft: 40 }]}>
										ऐप का नाम, पैकेज नाम, वर्जन आदि; KYC और ऑनबोर्डिंग हेतु
										उपयोग।
									</Text>

									<Text style={styles.listTitle}>
										• लोकेशन, कैमरा एवं माइक्रोफोन एक्सेस:
									</Text>
									<Text style={[styles.subListTitle, { paddingLeft: 20 }]}>
										◦ लोकेशन का उपयोग पता सत्यापन और KYC के लिए।
									</Text>
									<Text style={[styles.subListTitle, { paddingLeft: 20 }]}>
										◦ कैमरा से छवि सत्यापन (लेंडर के निर्देशानुसार, डेटा लेंडर
										को ट्रांसफर किया जाता है)।
									</Text>
									<Text style={[styles.subListTitle, { paddingLeft: 20 }]}>
										◦ माइक्रोफोन से वीडियो KYC हेतु ऑडियो रिकॉर्डिंग की जाती है।
									</Text>

									<Text style={styles.subSectionTitle}>
										3.3 तृतीय-पक्षों से प्राप्त जानकारी
									</Text>
									<Text style={styles.paragraph}>
										क्रेडिट ब्यूरो, NSDL, GST API आदि जैसे स्रोतों से आवश्यक
										जानकारी प्राप्त की जा सकती है (आपकी स्वीकृति के बाद) और इसे
										लेंडर को भेजा जाता है — ये जानकारी हमारे पास संग्रहीत नहीं
										रहती।
									</Text>

									<Text style={styles.subSectionTitle}>
										3.4 आपकी ओर से दी गई जानकारी
									</Text>
									<Text style={styles.paragraph}>
									    • पंजीकरण, समस्याओं की रिपोर्ट, आवेदन, KYC आदि के दौरान प्रदान
										की गई जानकारी जैसे नाम, पता, DOB, PAN, Aadhaar, बैंक विवरण,
										क्रेडिट स्टेटमेंट आदि।
									</Text>

									<Text style={styles.paragraph}>
										• ध्यान दें: बायोमेट्रिक डेटा कभी नहीं लिया जाता; यदि ऐसा
										अनुरोध होता है तो कृपया Grievance Officer को सूचित करें।
									</Text>

									{/* 4. जानकारी संग्रण और उपयोग */}
									<Text style={styles.sectionTitle}>
										4. जानकारी संग्रण और उपयोग (Storage & Usage)
									</Text>

									<Text style={styles.subSectionTitle}>4.1 संग्रण</Text>
									<Text style={styles.paragraph}>
										• केवल मूल जानकारी (जैसे नाम, पता, संपर्क विवरण) भारतीय
										सर्वर पर संग्रहीत की जाती है, अन्य डेटा सीधे लेंडर को
										ट्रांसफर किया जाता है।
									</Text>

									<Text style={styles.subSectionTitle}>
										4.2 गैर-व्यक्तिगत जानकारी
									</Text>
									<Text style={styles.paragraph}>
										• उपयोग व्यवहार, प्राथमिकताओं आदि जैसे सूचना का संग्रह एवं
										विश्लेषण किया जाता है—बिना व्यक्तिगत पहचान के।
									</Text>
									<Text style={styles.paragraph}>
										• कुकीज़ जैसी तकनीकों का उपयोग उपयोगकर्ता अनुभव बेहतर बनाने
										हेतु किया जाता है।
									</Text>

									{/* 5. उपयोग के उद्देश्य */}
									<Text style={styles.sectionTitle}>
										5. उपयोग के उद्देश्य (Purpose of Collection)
									</Text>
									<Text style={styles.paragraph}>
										जानकारी का प्रयोग निम्नलिखित हेतु किया जाता है:
									</Text>

									<Text style={styles.listItem}>• पहचान और KYC सत्यापन;</Text>
									<Text style={styles.listItem}>
										• प्लेटफॉर्म सेवाएं, समस्या निवारण, सुधार;
									</Text>
									<Text style={styles.listItem}>
										• ऋण या अन्य सेवाओं की सुविधा;
									</Text>
									<Text style={styles.listItem}>
										• थर्ड-पार्टी सहयोगियों के साथ सेवा और विश्लेषण;
									</Text>
									<Text style={styles.listItem}>
										• संचार और नोटिफिकेशन भेजना;
									</Text>
									<Text style={styles.listItem}>• विपणन और प्रचार सामग्री;</Text>
									<Text style={styles.listItem}>
										• डेटा विश्लेषण, उपयोगकर्ता संतुष्टि मापन;
									</Text>
									<Text style={styles.listItem}>
										• कानून और नियमों का अनुपालन;
									</Text>
									<Text style={styles.listItem}>
										• धोखाधड़ी या अन्य अवैध गतिविधियों का पता लगाना;
									</Text>
									<Text style={styles.listItem}>
										• सेवाओं का अनुकूलन और शर्तों का पालन सुनिश्चित करना।
									</Text>

									{/* 6. तीसरे पक्षों के साथ जानकारी साझा करना */}
									<Text style={styles.sectionTitle}>
										6. तीसरे पक्षों के साथ जानकारी साझा करना (Disclosure to
										Third Parties)
									</Text>
									<Text style={styles.paragraph}>
										• आपकी जानकारी केवल सेवा के उद्देश्य के लिए, और सीमित रूप से
										ही साझा की जाती है:
									</Text>
									<Text style={[styles.subListTitle, { paddingLeft: 20 }]}>
										◦ वित्तीय सेवा प्रदाता, बैंकों, NBFCs (लेंडर पार्टनर्स);
									</Text>
									<Text style={[styles.subListTitle, { paddingLeft: 20 }]}>
										◦ डेटा विश्लेषण और सेवा सुधार सहयोगियों;
									</Text>
									<Text style={[styles.subListTitle, { paddingLeft: 20 }]}>
										◦ न्यायिक/नियामक/सरकारी संस्थानों (कोर्ट के अनुरूप);
									</Text>
									<Text style={[styles.subListTitle, { paddingLeft: 20 }]}>
										◦ अन्य तकनीकी साझेदार, कॉर्पोरेट लेन-देन (जैसे
										विलय/अधिग्रहण) के दौरान।
									</Text>

									<Text style={styles.paragraph}>
										• सभी साझेदारी गुप्तता समझौते के अधीन होती हैं।
									</Text>
									<Text style={styles.paragraph}>
										• Aadhaar नंबर कभी साझा नहीं किया जाता।
									</Text>

									{/* 7. डेटा संरक्षण और सुरक्षा */}
									<Text style={styles.sectionTitle}>
										7. डेटा संरक्षण और सुरक्षा (Data Retention & Security)
									</Text>
									<Text style={styles.paragraph}>
										• आपकी जानकारी को अवैध पहुंच, उपयोग या प्रकटीकरण से बचाने के
										लिए तकनीकी, प्रशासनिक और भौतिक सुरक्षा उपाय अपनाए जाते हैं —
										जैसे SSL एन्क्रिप्शन, कड़ी पहुंच नियंत्रण, नियमित सुरक्षा
										समीक्षा इत्यादि।
									</Text>
									<Text style={styles.paragraph}>
										• केवल वही डेटा रखा जाता है जो सेवा प्रदान करने, कानूनी
										आवश्यकताओं, विवाद समाधान, या समझौता को लागू करने हेतु आवश्यक
										हो। हटाने का अनुरोध लिखित रूप में किया जा सकता है, लेकिन
										सेवाएं बाधित हो सकती हैं।
									</Text>

									{/* 8. आपकी अधिकार और शिकायत */}
									<Text style={styles.sectionTitle}>
										8. आपकी अधिकार और शिकायत (Your Rights & Grievance Redressal)
									</Text>
									<Text style={styles.paragraph}>
										• आप अपनी जानकारी संशोधित या सुधारने का अधिकार रखते
										हैं—संबंधित दस्तावेज प्रस्तुत करने की स्थिति में।
									</Text>
									<Text style={styles.paragraph}>
										• आप अनुमतियां रद्द कर सकते हैं, डेटा साझा करने पर रोक लगा
										सकते हैं, या खाता हटाने का अनुरोध कर सकते हैं (विशेष रूप से
										यदि कोई ऋण या सेवा मौजूद है, तो कुछ सीमाएं लागू हो सकती
										हैं)।
									</Text>
									<Text style={styles.paragraph}>
										• आप किसी सुरक्षा घटना की शिकायत Grievance Officer (श्री
										अमित अगाशे) को ईमेल (
										<Text
											style={styles.emailLink}
											onPress={() => Linking.openURL("mailto:grievance@rapidmoney.in")}>
											grievance@rapidmoney.in
										</Text>
										) या फोन (+91
										8097880793) द्वारा बता सकते हैं। शिकायतों का समाधान
										सोमवार-शनिवार, 10:00-19:00 के बीच किया जाएगा।
									</Text>

									{/* संक्षेप में */}
									<Text style={styles.sectionTitle}>संक्षेप में (Summary)</Text>
									<Text style={styles.listItem}>
										• संग्रह: व्यक्तिगत और तकनीकी जानकारी, केवल जरूरी मात्रा
										में।
									</Text>
									<Text style={styles.listItem}>
										• उपयोग: पहचान, KYC, सेवा सुविधा, सुधार, विपणन, कानूनी
										अनुपालन।
									</Text>
									<Text style={styles.listItem}>
										• सुरक्षा: SSL, एन्क्रिप्शन, पहुंच नियंत्रण, नियमित समीक्षा।
									</Text>
									<Text style={styles.listItem}>
										• शेयरिंग: केवल आवश्यक और सीमित लक्ष्य के लिए, NDA अधीन।
									</Text>
									<Text style={styles.listItem}>
										• अधिकार: जानकारी अपडेट, हटाने या रद्द करने का अधिकार;
										शिकायत के लिए ऑफिसर उपलब्ध।
									</Text>

									<Text style={styles.paragraph}>
										यदि आप चाहते हैं, तो मैं इस नीति का किसी अन्य हिस्से का
										विस्तृत अनुवाद या साराश भी पेश कर सकता हूं। कृपया बताएं!
									</Text>

									{/* Add some bottom padding for better scrolling */}
									<View style={styles.bottomPadding} />
								</View>
							</ScrollView>

							{/* Fixed Close Button */}
							<View style={styles.buttonContainer}>
								<TouchableOpacity style={styles.closeButton} onPress={handleClose}>
									<Text style={styles.closeButtonText}>ठीक है</Text>
								</TouchableOpacity>
							</View>
						</View>
					</SafeAreaView>
				)}
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	container: {
		flex: 1,
		width: "100%",
		paddingHorizontal: 20,
		paddingVertical: 40,
		height: height(80),
	},
	modalContent: {
		flex: 1,
		backgroundColor: "#ffffff",
		borderRadius: 12,
		overflow: "hidden",
	},
	header: {
		padding: 20,
		borderBottomWidth: 0.3,
		// borderBottomColor: "#e0e0e0",
		backgroundColor: "#f8f9fa",
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#333",
		textAlign: "center",
	},
	scrollContainer: {
		flex: 1,
	},
	content: {
		padding: 20,
	},
	paragraph: {
		fontSize: 14,
		lineHeight: 22,
		color: "#444",
		marginBottom: 16,
		textAlign: "justify",
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#333",
		marginTop: 24,
		marginBottom: 12,
	},
	subSectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		marginTop: 20,
		marginBottom: 10,
	},
	listTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333",
		marginTop: 16,
		marginBottom: 8,
	},
	subListTitle: {
		fontSize: 14,
		// fontWeight: "600",
		color: "#333",
		marginTop: 12,
		marginBottom: 6,
	},
	listItem: {
		fontSize: 14,
		lineHeight: 20,
		color: "#444",
		marginBottom: 8,
		paddingLeft: 10,
	},
	bottomPadding: {
		height: 20,
	},
	buttonContainer: {
		padding: 20,
		borderTopWidth: 1,
		borderTopColor: "#e0e0e0",
		backgroundColor: "#f8f9fa",
	},
	closeButton: {
		backgroundColor: primary,
		paddingVertical: 12,
		paddingHorizontal: 24,
		borderRadius: 8,
		alignItems: "center",
	},
	closeButtonText: {
		color: dark,
		fontSize: 16,
		fontWeight: "600",
	},
	emailLink: {
		color: "#09A143",
		textDecorationLine: "underline",
	},
});
