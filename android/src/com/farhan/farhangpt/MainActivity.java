package com.farhan.farhangpt;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.ValueCallback;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;

/** FarhanGPT's lightweight native client. No API credentials are bundled. */
public final class MainActivity extends Activity {
  private final int background = Color.rgb(11,11,16);
  private final int purple = Color.rgb(183,158,237);
  private SharedPreferences preferences;
  private WebView browser;
  private String website;
  private PermissionRequest pendingAudio;
  private ValueCallback<Uri[]> pendingFiles;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(background);
    getWindow().setNavigationBarColor(background);
    preferences = getSharedPreferences("farhangpt", MODE_PRIVATE);
    website = preferences.getString("website", "");
    if (website.isEmpty()) showSetup(); else showBrowser();
  }
  private int dp(int value) { return (int)(value * getResources().getDisplayMetrics().density); }
  private LinearLayout column(int padding) {
    LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
    layout.setBackgroundColor(background); layout.setFitsSystemWindows(true); layout.setPadding(dp(padding),dp(padding),dp(padding),dp(padding)); return layout;
  }
  private TextView text(String value, int size, int color) {
    TextView view = new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color); return view;
  }
  private void showSetup() {
    if (browser != null) { browser.stopLoading(); browser.destroy(); browser = null; }
    LinearLayout layout = column(30); layout.setGravity(Gravity.CENTER_VERTICAL);
    TextView symbol = text("✦",70,purple); symbol.setGravity(Gravity.CENTER); layout.addView(symbol);
    TextView title = text("FarhanGPT",32,Color.WHITE); title.setGravity(Gravity.CENTER); layout.addView(title);
    TextView subtitle = text("A little curiosity. Endless possibilities.",14,purple); subtitle.setGravity(Gravity.CENTER); subtitle.setPadding(0,dp(12),0,dp(36)); layout.addView(subtitle);
    TextView explanation = text("Your AI. Your website.\n\nEnter your published FarhanGPT HTTPS address to connect. Your account and conversations stay securely on your chosen server.",14,Color.rgb(167,154,182)); explanation.setLineSpacing(dp(4),1); layout.addView(explanation);
    final EditText address = new EditText(this); address.setSingleLine(true); address.setTextColor(Color.WHITE); address.setHintTextColor(Color.rgb(112,98,128)); address.setHint("https://your-farhangpt.workers.dev"); address.setInputType(17); address.setText(website); address.setPadding(dp(12),dp(16),dp(12),dp(16));
    LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(-1,dp(60)); inputParams.topMargin=dp(24); layout.addView(address,inputParams);
    Button connect = new Button(this); connect.setText("Connect to my workspace  ↗"); connect.setTextColor(background); connect.setBackgroundTintList(android.content.res.ColorStateList.valueOf(purple)); connect.setAllCaps(false);
    LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(-1,dp(54)); buttonParams.topMargin=dp(18); layout.addView(connect,buttonParams);
    connect.setOnClickListener(view -> {
      String value=address.getText().toString().trim();
      if (!value.startsWith("https://")) value="https://"+value;
      Uri uri=Uri.parse(value);
      if (!"https".equals(uri.getScheme()) || uri.getHost()==null || !uri.getHost().contains(".") || uri.getUserInfo()!=null) { address.setError("Please enter a valid HTTPS website address."); return; }
      website=uri.buildUpon().path("/").clearQuery().fragment(null).build().toString();
      preferences.edit().putString("website",website).apply(); showBrowser();
    });
    TextView privacy=text("Private by design. No API keys stored in this app.\nYou can change your website from the app menu.",11,Color.rgb(107,93,121)); privacy.setGravity(Gravity.CENTER); privacy.setPadding(0,dp(28),0,0); privacy.setLineSpacing(dp(5),1); layout.addView(privacy);
    setContentView(layout);
  }
  private void showBrowser() {
    LinearLayout layout=column(0);
    LinearLayout bar=new LinearLayout(this); bar.setGravity(Gravity.CENTER_VERTICAL); bar.setPadding(dp(16),0,dp(8),0); bar.setBackgroundColor(background);
    TextView brand=text("✦  FarhanGPT",14,purple); bar.addView(brand,new LinearLayout.LayoutParams(0,dp(40),1)); brand.setGravity(Gravity.CENTER_VERTICAL);
    TextView menu=text("⋮",24,Color.rgb(160,141,181)); menu.setGravity(Gravity.CENTER); bar.addView(menu,new LinearLayout.LayoutParams(dp(40),dp(40)));
    menu.setOnClickListener(view -> { PopupMenu popup=new PopupMenu(this,menu); popup.getMenu().add("Reload"); popup.getMenu().add("Change website"); popup.getMenu().add("Open in browser"); popup.getMenu().add("About FarhanGPT"); popup.setOnMenuItemClickListener(item -> { String choice=item.getTitle().toString(); if(choice.equals("Reload")) browser.reload(); else if(choice.equals("Change website")) showSetup(); else if(choice.equals("Open in browser")) openExternal(website); else Toast.makeText(this,"FarhanGPT 1.0 · Made for curious minds.\nNative website client · Development-signed build",Toast.LENGTH_LONG).show(); return true; }); popup.show(); });
    layout.addView(bar,new LinearLayout.LayoutParams(-1,dp(40)));
    browser=new WebView(this); browser.setBackgroundColor(background); browser.setOverScrollMode(View.OVER_SCROLL_NEVER);
    WebSettings settings=browser.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setDatabaseEnabled(true); settings.setAllowFileAccess(false); settings.setAllowContentAccess(true); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); settings.setMediaPlaybackRequiresUserGesture(true);
    CookieManager.getInstance().setAcceptCookie(true);
    browser.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return route(request.getUrl()); }
      @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return route(Uri.parse(url)); }
      private boolean route(Uri uri) { if ("https".equals(uri.getScheme()) && Uri.parse(website).getHost().equals(uri.getHost())) return false; openExternal(uri.toString()); return true; }
      @Override public void onPageFinished(WebView view,String url) { CookieManager.getInstance().flush(); }
    });
    browser.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (pendingFiles != null) pendingFiles.onReceiveValue(null);
        pendingFiles = callback;
        try { startActivityForResult(params.createIntent(), 20); return true; }
        catch (Exception error) { pendingFiles = null; Toast.makeText(MainActivity.this,"No file picker is available on this device.",Toast.LENGTH_SHORT).show(); return false; }
      }
      @Override public void onPermissionRequest(final PermissionRequest request) {
        runOnUiThread(() -> {
          if (!Uri.parse(website).getHost().equals(request.getOrigin().getHost())) { request.deny(); return; }
          boolean wantsAudio=false; for(String resource:request.getResources()) if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) wantsAudio=true;
          if (!wantsAudio) { request.deny(); return; }
          if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED) request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
          else { pendingAudio=request; requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},10); }
        });
      }
      @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (pendingAudio==request) pendingAudio=null; }
    });
    browser.setDownloadListener((url,userAgent,contentDisposition,mimetype,length) -> {
      if (!"https".equals(Uri.parse(url).getScheme())) { Toast.makeText(this,"Only secure downloads are supported.",Toast.LENGTH_SHORT).show(); return; }
      try {
        DownloadManager.Request request=new DownloadManager.Request(Uri.parse(url)); String cookies=CookieManager.getInstance().getCookie(url); if(cookies!=null)request.addRequestHeader("Cookie",cookies); request.addRequestHeader("User-Agent",userAgent);
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED); request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,URLUtil.guessFileName(url,contentDisposition,mimetype)); ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(request); Toast.makeText(this,"Download started.",Toast.LENGTH_SHORT).show();
      } catch(Exception error) { openExternal(url); }
    });
    layout.addView(browser,new LinearLayout.LayoutParams(-1,0,1)); setContentView(layout); browser.loadUrl(website);
  }
  private void openExternal(String url) { try { Uri uri=Uri.parse(url); if("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()) || "mailto".equals(uri.getScheme())) startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch(Exception error) { Toast.makeText(this,"No app available to open this link.",Toast.LENGTH_SHORT).show(); } }
  @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results) { super.onRequestPermissionsResult(code,permissions,results); if(code==10 && pendingAudio!=null) { if(results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED) pendingAudio.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}); else pendingAudio.deny(); pendingAudio=null; } }
  @Override protected void onActivityResult(int code, int result, Intent data) {
    super.onActivityResult(code,result,data);
    if (code==20 && pendingFiles!=null) { pendingFiles.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data)); pendingFiles=null; }
  }
  @Override public void onBackPressed() { if(browser!=null && browser.canGoBack()) browser.goBack(); else super.onBackPressed(); }
  @Override protected void onPause() { super.onPause(); if(browser!=null) { browser.onPause(); CookieManager.getInstance().flush(); } }
  @Override protected void onResume() { super.onResume(); if(browser!=null) browser.onResume(); }
  @Override protected void onDestroy() { if(browser!=null) browser.destroy(); super.onDestroy(); }
}
