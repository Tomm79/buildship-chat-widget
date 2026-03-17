# BuildShip AI Chat Widget

An open-source AI chat widget that can be easily embedded on your website or app. This plug-and-play widget is designed to work seamlessly with your custom [BuildShip](https://buildship.com/) workflow, allowing it to connect with your database, knowledge repository, and any other tools that you use.

With this powerful AI chat assistant, you can enhance the user experience of your website or app significantly.

## Getting started

### Step 1. Add the widget to your website or app

- First, load the chat widget on your page by adding the following code snippet. Then connect the widget to your BuildShip workflow by replacing the sample API URL with your BuildShip deployed API url as per the instructions [in Step 2](#step-2-connecting-the-chat-widget-to-your-buildship-workflow). Add any [customization](#step-3-config-properties-and-customization) options as needed.

  ```html
  <script src="https://unpkg.com/@buildshipapp/chat-widget@^1" defer></script>
  <script>
    window.addEventListener("load", () => {
      window.buildShipChatWidget.config.widgetTitle = "Chatbot";
      window.buildShipChatWidget.config.greetingMessage =
        "Hello! How may I help you today?";
      window.buildShipChatWidget.config.url =
        "https://<project_id>.buildship.run/chat/....";
      <!-- Other optional properties, learn more in the `Config Properties` section below -->
    });
  </script>
  ```

  You may also import it as a module if you're working with TypeScript or ES6 (type declarations are included):

  ```typescript
  import "@buildshipapp/chat-widget";

  window.buildShipChatWidget.config.widgetTitle = "Chatbot";
  window.buildShipChatWidget.config.greetingMessage =
    "Hello! How may I help you today?";
  window.buildShipChatWidget.config.url =
    "https://<project_id>.buildship.run/chat/....";
  // ...
  ```

- Secondly, place a button with the following data-attribute anywhere on your website or app to open the widget:

  ```html
  <button data-chat-widget-button>Beep Boop</button>
  ```

<!-- Checkout this complete HTML code snippet sample if you want to test this out in your app first. This snippet has custom CSS styling for the button as well as a deployed test BuildShip API plugged in it. Simply copy paste from here into your website or app with HTML embed element say on Framer or Website and publish to give it a try. -->

### Step 2. Connecting the chat widget to your BuildShip workflow

The widget is built to work with [BuildShip](https://buildship.com/) - a lowcode backend builder for creating APIs, scheduled jobs visually and fast with a drag-and-drop interface.

- Get started by cloning any of these [chat widget templates](https://buildship.com/assistant-api#templates) closest to your usecase
- Add in your OpenAI Assistant ID and API Key and then ship the workflow. You will get an API URL once you deploy your workflow.
- Plug in this workflow endpoint URL into the widget by setting the `window.buildShipChatWidget.config.url` property. See [Step 3](#step-3-config-properties-and-customization) for more details.
- You can also customize this template workflow any way you would like.

#### Requirements for your BuildShip workflow

1. The widget will make a POST request to this URL. The request body will be an object containing the user's message and other data for the workflow to make use of, like so:

   ```json
   {
     "message": "The user's message",
     "threadId": "A unique identifier for the conversation (learn more below)",
     "timestamp": "The timestamp of when the POST request was initiated"

     ...Other miscellaneous user data (learn more in the 'Config Properties' section below)
   }
   ```

   You can learn more about each of the properties [in the next section](#step-3-config-properties-and-customization).

2. The widget will expect a response from the endpoint in the form of a JSON object containing the workflow's response (`message`) and the thread ID (`threadId`), like so:

   ```json
   {
     "message": "The bot's response",
     "threadId": "The unique identifier for the conversation (learn more below)"
   }
   ```

#### Streamed responses

In case of a streamed response, the widget won't expect a JSON object as described above, but will instead expect a stream of chunks that eventually add up to the response message. The widget will aggregate these chunks as they're received and display and update the message in real time, finally ending with the full response.

##### Setting the `threadId` through the response

Optionally, there are two ways to set the `threadId` through the response.

1. Via a response header

   If the response includes a header with the key `x-thread-id` with the thread ID as the value, the widget will automatically pick it up and set it as the `threadId` for the conversation (if it's not already set).

   NOTE: Make sure to set the `Access-Control-Expose-Headers` header in your response to expose the `x-thread-id` header to the client widget.

2. Via the stream itself

   If the endpoint responds with the `message` and the `threadId` in the following format: `message` + `\x1f` + `threadId`, where `\x1f` is the unit separator character, the widget will then extract the thread ID from the stream and set it as the `threadId` for the conversation (if it's not already set). For example:

   ```typescript
   // Simulating what a streamed response might look like where
   // message: "Hello world!"
   // threadId: "tId_123"
   readable.push("Hello ");
   readable.push("world!");
   readable.push("\x1f" + "tId_123"); // No spaces between the end of the message, the unit separator character, and the beginning of the threadId
   ```

### Step 3. Config Properties and Customization

The widget can be customized by editing the properties present in the `window.buildShipChatWidget.config` object.

| Property                                              | Type     | Description |
| ----------------------------------------------------- | -------- | ----------- |
| `window.buildShipChatWidget.config.url` | Required | Endpoint that receives the chat POST request. |
| `window.buildShipChatWidget.config.threadId` | Optional | Conversation identifier. Defaults to the widget's session cookie value when present. If you do not set it, the widget starts without a thread ID and can adopt one returned by your backend. |
| `window.buildShipChatWidget.config.responseIsAStream` | Optional | Whether the backend response is streamed. Defaults to `true`. See [Streamed responses](#streamed-responses). |
| `window.buildShipChatWidget.config.user` | Optional | Arbitrary user metadata sent with each request. |
| `window.buildShipChatWidget.config.widgetTitle` | Optional | Header title. Defaults to `Chatbot`. |
| `window.buildShipChatWidget.config.greetingMessage` | Optional | Initial system message rendered inside the conversation when the widget opens. Default: no greeting message. |
| `window.buildShipChatWidget.config.disableErrorAlert` | Optional | Disables built-in alert popups for missing URL, failed requests, and similar runtime errors. Defaults to `false`. |
| `window.buildShipChatWidget.config.closeOnOutsideClick` | Optional | Adds a backdrop and lets users close the widget by clicking outside of it. Defaults to `false`. |
| `window.buildShipChatWidget.config.openOnLoad` | Optional | Opens the widget on page load. Requires an element with the `data-chat-widget-button` attribute so the widget can anchor itself. Defaults to `false`. |
| `window.buildShipChatWidget.config.linkTarget` | Optional | Target used for links rendered inside chat messages, for example `self` or `blank`. Defaults to `self`. |
| `window.buildShipChatWidget.config.urlFetchThreadHistory` | Optional | POST endpoint used to preload an existing conversation when a `threadId` is already known. |
| `window.buildShipChatWidget.config.urlFetchUpdateThreadHistory` | Optional | POST endpoint used to sync updated thread history back to your backend. |
| `window.buildShipChatWidget.config.addClearChat` | Optional | Shows the clear-chat control in the widget header. Defaults to `false`. |
| `window.buildShipChatWidget.config.privacyInfoLinkText` | Optional | Label of the privacy link shown in a fresh conversation. Defaults to `Infos zum Datenschutz`. |
| `window.buildShipChatWidget.config.privacyNoticeText` | Optional | Privacy notice content rendered inside the widget. Defaults to `Bitte geben Sie keine sensiblen Daten ein.` |
| `window.buildShipChatWidget.config.launcher` | Optional | Floating launcher configuration. See [Launcher configuration](#launcher-configuration). |
| `window.buildShipChatWidget.config.persistOpenState` | Optional | Persists whether the widget was pinned open across reloads. Defaults to `false`. |
| `window.buildShipChatWidget.config.collapseTabLabel` | Optional | Accessible label and visible text for the collapse tab. Defaults to `Hide chatbot`. |
| `window.buildShipChatWidget.config.hideTargets` | Optional | Hides selected DOM elements while the widget is open or the launcher is visible. See [Hide targets](#hide-targets). |

#### Modern configuration example

```html
<button data-chat-widget-button>Chat with us</button>

<script>
  window.addEventListener("load", () => {
    window.buildShipChatWidget.config.url =
      "https://<project_id>.buildship.run/chat/....";
    window.buildShipChatWidget.config.widgetTitle = "Support";
    window.buildShipChatWidget.config.greetingMessage =
      "Hello! How can we help?";
    window.buildShipChatWidget.config.responseIsAStream = true;
    window.buildShipChatWidget.config.linkTarget = "blank";
    window.buildShipChatWidget.config.openOnLoad = false;
    window.buildShipChatWidget.config.persistOpenState = true;
    window.buildShipChatWidget.config.addClearChat = true;
    window.buildShipChatWidget.config.urlFetchThreadHistory =
      "https://<project_id>.buildship.run/thread-history/load";
    window.buildShipChatWidget.config.urlFetchUpdateThreadHistory =
      "https://<project_id>.buildship.run/thread-history/update";
    window.buildShipChatWidget.config.privacyInfoLinkText = "Privacy Notice";
    window.buildShipChatWidget.config.privacyNoticeText =
      "Please do not enter any sensitive data.";
    window.buildShipChatWidget.config.hideTargets = {
      ids: ["site-header-phone"],
      classes: ["hide-when-chat-is-visible"],
    };
    window.buildShipChatWidget.config.launcher = {
      enabled: true,
      text: "Chat",
      ariaLabel: "Open support chat",
      showGreeting: true,
      greetingText: "Hi, how can I help you?",
      rememberVisibility: true,
      openTriggerClass: "chat-widget-open-trigger",
      restrictToPaths: ["/", "/help/*"],
      hideOnPaths: ["/checkout", "/help/internal/*"],
      placement: {
        bottom: "32px",
        right: "32px",
      },
    };
  });
</script>
```

#### Launcher configuration

Use `window.buildShipChatWidget.config.launcher` to enable a floating launcher button in addition to the regular `[data-chat-widget-button]` trigger.

| Property | Type | Description |
| -------- | ---- | ----------- |
| `enabled` | `boolean` | Enables the floating launcher. Defaults to `false`. |
| `text` | `string` | Visible launcher label. Defaults to `Chat`. |
| `ariaLabel` | `string` | Accessible label for the launcher button. Defaults to `Open chatbot`. |
| `placement` | `object` | Optional offsets for `top`, `right`, `bottom`, and `left`. Defaults to `bottom: "2rem"` and `right: "2rem"`. |
| `showGreeting` | `boolean` | Controls the small greeting bubble next to the launcher. Defaults to `true`. |
| `greetingText` | `string` | Greeting bubble text. Defaults to `Hi, how can I help you?`. |
| `rememberVisibility` | `boolean` | Persists forced launcher visibility after the user has interacted with the widget. Defaults to `true`. |
| `openTriggerClass` | `string` | CSS class for external elements that should open the widget when clicked. Defaults to `chat-widget-open-trigger`. |
| `restrictToPaths` | `string[]` | Only show the launcher on matching paths. Default: `[]`. |
| `hideOnPaths` | `string[]` | Hide the launcher on matching paths. Default: `[]`. |

Launcher path rules:

- `*` matches all pages.
- Exact matches such as `/contact` are supported.
- Prefix matches such as `/docs/*` are supported.
- Full URLs are accepted and matched by their pathname.
- If both `restrictToPaths` and `hideOnPaths` match the current page, `hideOnPaths` wins.
- If `rememberVisibility` is enabled, launcher visibility forced by prior interaction overrides path filters on later reloads.
- Elements using `openTriggerClass` are also hidden and ignored on pages excluded by the path filters.

Examples:

```js
window.buildShipChatWidget.config.launcher = {
  enabled: true,
  restrictToPaths: ["/", "/contact", "/docs/*"],
};
```

```js
window.buildShipChatWidget.config.launcher = {
  enabled: true,
  hideOnPaths: ["/checkout", "/legal/*"],
};
```

```js
window.buildShipChatWidget.config.launcher = {
  enabled: true,
  restrictToPaths: ["/docs/*"],
  hideOnPaths: ["/docs/private/*"],
};
```

#### Conversation history and reset behavior

- If `threadId` and `urlFetchThreadHistory` are set, the widget preloads the existing thread history before opening and injects those messages into the UI.
- If `urlFetchUpdateThreadHistory` is set, new messages can be synced back to your backend as the in-memory thread history is updated.
- If `persistOpenState` is enabled, the widget remembers whether the user pinned it open and can reopen automatically after reload.
- If `addClearChat` is enabled, the header shows a clear button that clears the stored conversation state, resets the local `threadId`, clears the session cookie, removes prefetched messages, and restores the initial greeting/privacy state.

#### Privacy and auxiliary UI behavior

- `privacyInfoLinkText` controls the link text shown for a fresh conversation before the chat becomes active.
- `privacyNoticeText` controls the inline privacy notice displayed inside the widget.
- Once the user starts a conversation or a thread is already active, the privacy link is hidden.
- If `addClearChat` is enabled, the header also exposes a privacy info toggle so users can reopen the privacy notice after it has been dismissed.

#### Hide targets

Use `window.buildShipChatWidget.config.hideTargets` to temporarily hide existing DOM elements while the widget is open or while the launcher is visible.

```js
window.buildShipChatWidget.config.hideTargets = {
  ids: ["header-phone"],
  classes: ["hide-when-chat"],
};
```

- `ids` hides specific elements by `id`.
- `classes` hides all matching elements by class name.
- The widget restores the previous inline `display` value when those elements become visible again.

#### Customizing the widget's appearance (optional)

The widget’s styling can be customized by overriding the CSS variables and/or the rules. (See [here](https://github.com/rowyio/buildship-chat-widget/blob/main/src/widget.css) for a list of variables and selectors).

For example, the variables can be overridden like so:

```css
:root {
  --buildship-chat-widget-primary-color: #0000ff;
}
```

The widget ships with a single built-in light theme. It no longer reacts to
system dark mode or page-level `data-theme` attributes. If needed, customize
its appearance by overriding the same CSS variables or selectors in your page
styles.

The font is inherited from the body.

## How it works

When the script is loaded, it looks for an element with the `data-chat-widget-button` attribute and uses it as the standard trigger for opening the widget.

In addition to the `config` object, the `window.buildShipChatWidget` object also exposes the `open()`, `close()` and `init()` methods, which can be called directly.

The `open()` method accepts the click `event`, and uses `event.target` to compute the widget's position using [Floating UI](https://floating-ui.com/).

The `close()` method closes the widget.

The `init()` method initializes the widget, and is called automatically when the window finishes loading. It can be called manually to re-initialize the widget if needed (particularly useful in case of SPAs, where the widget might need to be re-initialized after a route change).
