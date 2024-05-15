"use strict";

import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from "gi://St";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as Slider from "resource:///org/gnome/shell/ui/slider.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const BrightnessEffectName = "brightness-effect";

let tinter = null;
let metadata = null;
let menu = null;
let overlay = {
  active: false,
  brightness: 100,
};

export default class AlphaTinter extends Extension {
  constructor(metadata) {
    super(metadata);
  }

  enable() {
    tinter = this;
    metadata = this.metadata;
    this.start_up();
    menu = new MenuButton();
    Main.panel.addToStatusArea("Tint", menu, 0, "right");
  }

  disable() {
    tinter.stop_now();
    menu.destroy();
    menu = null;
    metadata = null;
    tinter = null;
  }

  // Create Tint Overlay
  createOverlay() {
    this._effect = new Clutter.BrightnessContrastEffect();
    this.setOverlayBrightness();
  }

  // Update color of overlay
  setOverlayBrightness() {
    this._effect.brightness = Clutter.Color.new(
      overlay["brightness"],
      overlay["brightness"],
      overlay["brightness"],
      255
    );
    if (overlay.active) {
      Main.uiGroup.remove_effect_by_name(BrightnessEffectName);
      Main.uiGroup.add_effect_with_name(BrightnessEffectName, this._effect);
    }
    this.saveState();
  }

  // Hide overlay
  hide() {
    overlay.active = false;
    Main.uiGroup.remove_effect_by_name(BrightnessEffectName);
    this.saveState();
  }

  // Show overlay
  show() {
    Main.uiGroup.add_effect_with_name(BrightnessEffectName, this._effect);
    overlay.active = true;
    this.saveState();
  }

  // Load state
  loadState() {
    // Load last from json
    this._file = Gio.file_new_for_path(`${metadata.path}/settings.json`);
    if (this._file.query_exists(null)) {
      let [flag, data] = this._file.load_contents(null);

      if (flag) {
        const textDecoder = new TextDecoder();
        let prepData =
          data instanceof Uint8Array
            ? textDecoder.decode(data)
            : data.toString();
        overlay = JSON.parse(prepData);
      }
    }
  }

  // Save state
  saveState() {
    this._file = Gio.file_new_for_path(`${metadata.path}/settings.json`);
    this._file.replace_contents(JSON.stringify(overlay), null, false, 0, null);
  }

  // Enable
  start_up() {
    overlay.active = false;
    this.loadState();
    this.createOverlay();
  }

  // Disable
  stop_now() {
    if (overlay.active == true) {
      Main.uiGroup.remove_effect_by_name(BrightnessEffectName);
    }
  }
}

const MenuButton = GObject.registerClass(
  {
    GTypeName: "MenuButton",
  },
  class MenuButton extends PanelMenu.Button {
    // Constructor
    _init() {
      super._init(1, "AlphaTintMenu", false);
      let icon = new St.Icon({
        icon_name: "display-brightness-symbolic",
        style_class: "system-status-icon",
      });

      // We add the icon to the button
      // It will be showed in the Top Panel
      this.add_child(icon);

      let popupMenuExpander = new PopupMenu.PopupSubMenuMenuItem(
        "PopupSubMenuMenuItem"
      );

      // This is an example of PopupMenuItem, a menu item. We will use this to add as a submenu
      let submenu = new PopupMenu.PopupMenuItem("PopupMenuItem");
      popupMenuExpander.menu.addMenuItem(submenu);

      let tintSwitch = new PopupMenu.PopupSwitchMenuItem(
        "Tint",
        overlay.active
      );

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      this.menu.addMenuItem(tintSwitch);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      let toggleTint = function (_object, value) {
        if (value) {
          tinter.show();
        } else {
          tinter.hide();
        }
      };
      tintSwitch.connect("toggled", toggleTint.bind(tintSwitch));

      this._alphaSlider = new Slider.Slider(0);
      let _alphaLabel = new St.Label({ text: "Brightness" });
      this._alphaSliderContainer = new PopupMenu.PopupBaseMenuItem({
        activate: false,
      });
      this._alphaSliderContainer.add_child(_alphaLabel);
      this._alphaSliderContainer.add_child(this._alphaSlider);
      this.menu.addMenuItem(this._alphaSliderContainer);

      this._alphaSlider.connect(
        "notify::value",
        this._setBrightness.bind(this._alphaSlider)
      );

      this._getBrightness(this._alphaSlider);
    }

    _getBrightness(slider) {
      slider._setCurrentValue(slider, (overlay["brightness"] - 64) / 63);
    }

    _setBrightness(slider) {
      overlay["brightness"] = 64 + slider._getCurrentValue() * 63;
      tinter.setOverlayBrightness();
    }
  }
);
