import { Images } from "@/constants/images";
import { ImageSourcePropType } from "react-native";
import { VideoSource } from "expo-video";

export interface VideoTutorialItem {
	id: string;
	title: string;
	duration: string;
	thumbnail: ImageSourcePropType;
	videoUrl: VideoSource;
	description?: string;
}

// Local videos provided in assets/videos for testing playback
export const VIDEO_TUTORIALS: VideoTutorialItem[] = [
	{
		id: "1",
		title: "How to claim ₹15,000 in 2 mins",
		duration: "1:24",
		thumbnail: Images.VIDEO_CARD_1,
		videoUrl: require("@/assets/videos/video_1.mp4"),
		description: "Step-by-step walkthrough to complete your KYC and claim instant credit.",
	},
	{
		id: "2",
		title: "Avoid these common loan rejection mistakes",
		duration: "0:45",
		thumbnail: Images.VIDEO_CARD_2,
		videoUrl: require("@/assets/videos/video_2.mp4"),
		description: "Key things to check before submitting PAN and Aadhaar details.",
	},
	{
		id: "3",
		title: "How RBI-partners verify Aadhaar details",
		duration: "1:15",
		thumbnail: Images.VIDEO_CARD_3,
		videoUrl: require("@/assets/videos/video_3.mp4"),
		description: "Understanding RBI NBFC security, OTP verification, and DigiLocker.",
	},
];
