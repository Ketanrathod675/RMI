const { withAndroidManifest, withMainActivity, withMainApplication } = require("@expo/config-plugins");

// Branch API Keys
// TODO: Replace with your actual Branch live and test keys once confirmed
const BRANCH_LIVE_KEY = "REPLACE_WITH_LIVE_KEY";
const BRANCH_TEST_KEY = "REPLACE_WITH_TEST_KEY";

module.exports = function withBranch(config) {
  // 1. AndroidManifest modifications
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Detect which EAS profile is building on the cloud (defaults to development locally)
    const buildProfile = process.env.EAS_BUILD_PROFILE || "development";
    
    const isProduction = buildProfile === "production";
    const branchKey = isProduction 
      ? BRANCH_LIVE_KEY 
      : BRANCH_TEST_KEY;
    
    const branchTestMode = isProduction ? "false" : "true";

    console.log(`[Branch Plugin] Build Profile: ${buildProfile} | TestMode: ${branchTestMode} | Key: ${branchKey.slice(0, 15)}...`);

    // Clean up old Branch tags to avoid duplicates in regenerated manifests
    if (mainApplication["meta-data"]) {
      mainApplication["meta-data"] = mainApplication["meta-data"].filter(
        (item) => 
          item.$["android:name"] !== "io.branch.sdk.BranchKey" &&
          item.$["android:name"] !== "io.branch.sdk.BranchKey.test" &&
          item.$["android:name"] !== "io.branch.sdk.TestMode"
      );
    } else {
      mainApplication["meta-data"] = [];
    }

    // Insert Branch configurations dynamically
    mainApplication["meta-data"].push(
      {
        $: {
          "android:name": "io.branch.sdk.BranchKey",
          "android:value": branchKey,
        },
      },
      {
        $: {
          "android:name": "io.branch.sdk.BranchKey.test",
          "android:value": BRANCH_TEST_KEY,
        },
      },
      {
        $: {
          "android:name": "io.branch.sdk.TestMode",
          "android:value": branchTestMode,
        },
      }
    );

    return config;
  });

  // 2. MainApplication modifications
  config = withMainApplication(config, (config) => {
    let content = config.modResults.contents;
    
    // Add import if not present
    if (!content.includes("import io.branch.rnbranch.RNBranchModule")) {
      content = content.replace(
        "class MainApplication : Application(), ReactApplication {",
        "import io.branch.rnbranch.RNBranchModule\n\nclass MainApplication : Application(), ReactApplication {"
      );
    }
    
    // Add initialization call if not present
    if (!content.includes("RNBranchModule.getAutoInstance(this)")) {
      content = content.replace(
        "super.onCreate()",
        "super.onCreate()\n    RNBranchModule.getAutoInstance(this)"
      );
    }
    
    config.modResults.contents = content;
    return config;
  });

  // 3. MainActivity modifications
  config = withMainActivity(config, (config) => {
    let content = config.modResults.contents;
    
    // Add imports if not present
    if (!content.includes("import io.branch.rnbranch.RNBranchModule")) {
      content = content.replace(
        "class MainActivity : ReactActivity() {",
        "import io.branch.rnbranch.RNBranchModule\nimport android.content.Intent\n\nclass MainActivity : ReactActivity() {"
      );
    }
    
    // Add onStart and onNewIntent if not present
    if (!content.includes("RNBranchModule.initSession")) {
      const startAndNewIntent = `
  override fun onStart() {
    super.onStart()
    RNBranchModule.initSession(intent?.data, this)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    RNBranchModule.onNewIntent(intent)
  }
`;
      content = content.replace(
        "class MainActivity : ReactActivity() {",
        `class MainActivity : ReactActivity() {${startAndNewIntent}`
      );
    }
    
    config.modResults.contents = content;
    return config;
  });

  return config;
};
