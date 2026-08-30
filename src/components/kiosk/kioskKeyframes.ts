// Every animation the kiosk runs, in one place.
//
// They live in a module rather than inline in KioskInterior for two reasons:
// the interior was carrying two hundred and sixty lines of CSS in the middle
// of its markup, and nothing else could get at them — which meant any harness
// that wanted to look at one of these animations had to keep its own COPY of
// it, and verify the copy instead of the thing.
//
// Injected once, as a plain <style> rather than styled-jsx: keyframes declared
// inside a styled-jsx block never resolve from a React inline `style`, which
// is a whole afternoon nobody needs to lose twice.

export const KIOSK_KEYFRAMES = `
        @keyframes kioskSlideInRight {
          from { transform: translateX(100%) scale(0.92); }
          to   { transform: translateX(0)    scale(1);    }
        }
        @keyframes kioskSlideInLeft {
          from { transform: translateX(-100%) scale(0.92); }
          to   { transform: translateX(0)     scale(1);    }
        }
        @keyframes kioskWallArrive {
          from { opacity: 0.6; }
          to   { opacity: 0;   }
        }
        @keyframes kioskSeam {
          0%   { opacity: 0; }
          35%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes kioskLabelIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes kioskCarve {
          from { transform: translateX(-50%) scale(1.04); }
          to   { transform: translateX(-50%) scale(1);    }
        }
        @keyframes kioskHint {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1;    }
        }
        /* Customers rise from behind the sill rather than fading in on the
           road. --rise is however much of them clears it, set per sprite, so
           they start exactly out of sight. The two beats past zero are the
           bob of someone leaning up to a window a touch too eagerly. */
        @keyframes kioskCustomerPop {
          0%   { transform: translateX(-50%) translateY(var(--rise)); }
          62%  { transform: translateX(-50%) translateY(-7%);         }
          82%  { transform: translateX(-50%) translateY(2%);          }
          100% { transform: translateX(-50%) translateY(0);           }
        }
        @keyframes kioskCustomerDuck {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0);           }
          65%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(var(--rise)); }
        }
        /* Paid, and delighted about it: two hops on the spot, the second one
           smaller, with the squash landing on the counter side of each. Every
           keyframe carries its own easing — the rise has to slow and the fall
           has to speed up, and a single easing over the whole thing floats
           like the moon rather than dropping like a cat. */
        @keyframes kioskCheer {
          0%   { transform: translateY(0)    scale(1, 1);       animation-timing-function: ease-out; }
          9%   { transform: translateY(1.5%) scale(1.05, 0.95); animation-timing-function: cubic-bezier(0.15, 0.85, 0.4, 1); }
          32%  { transform: translateY(-11%) scale(0.97, 1.04); animation-timing-function: cubic-bezier(0.55, 0, 0.9, 0.45); }
          50%  { transform: translateY(0)    scale(1.06, 0.94); animation-timing-function: cubic-bezier(0.15, 0.85, 0.4, 1); }
          71%  { transform: translateY(-6%)  scale(0.98, 1.02); animation-timing-function: cubic-bezier(0.55, 0, 0.9, 0.45); }
          87%  { transform: translateY(0)    scale(1.04, 0.96); animation-timing-function: ease-out; }
          100% { transform: translateY(0)    scale(1, 1);       }
        }
        /* Given up on you: they sink under the sill AND slide off down the
           street, so a walk-out never reads as the same beat as a sale. */
        @keyframes kioskCustomerWalk {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-140%) translateY(calc(var(--rise) * 0.7)); }
        }
        /* One drop's whole fall. The translate is in PERCENT of the streak's
           own full-height column, so a single keyframe fits any window size,
           and the rotate before it makes the drop fall the way it leans.
           -110% to 110% keeps it out of sight at both ends. */
        @keyframes kioskRainFall {
          from { transform: rotate(var(--tilt, 8deg)) translate3d(0, -110%, 0); }
          to   { transform: rotate(var(--tilt, 8deg)) translate3d(0,  110%, 0); }
        }
        /* Fog rolling past, and breathing while it does. */
        @keyframes kioskFogDrift {
          0%   { transform: translateX(-14%) scale(1);      opacity: 0.55; }
          50%  { transform: translateX(12%)  scale(1.12);   opacity: 1;    }
          100% { transform: translateX(-14%) scale(1);      opacity: 0.55; }
        }
        /* Litter going past the window. The sag is how far it drops on the
           way across, and the spin tells a leaf from a paper scrap. */
        @keyframes kioskWindBlow {
          0%   { opacity: 0; transform: translate(-10%, 0) rotate(0deg); }
          10%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { opacity: 0; transform: translate(1400%, var(--sag)) rotate(var(--spin)); }
        }
        /* And the gust behind them. */
        @keyframes kioskWindGust {
          0%, 62%, 100% { transform: translateX(-30%); opacity: 0;   }
          70%           { opacity: 1;   }
          92%           { transform: translateX(30%);  opacity: 0;   }
        }
        /* A sleeve across the misted pane. */
        @keyframes kioskWipe {
          from { transform: translateX(-120%) skewX(-8deg); }
          to   { transform: translateX(320%)  skewX(-8deg); }
        }
        /* A coin off the ledge and into the jar. It leaves the hand upward
           and lands downward, because that is what a thrown coin does — a
           straight line between the two reads as a cursor.

           The arc is split across two elements. This one carries the FLIGHT,
           and its --lift is per-coin, so a handful thrown together fans out
           instead of moving like one rigid object. The spin lives on a child
           (kioskTipFlip) on its own clock: a coin tumbles several times on the
           way across, which a single keyframe list can't express while it is
           already busy describing a parabola. */
        @keyframes kioskTipCoin {
          0%   { opacity: 0; transform: translate(0, 0); }
          8%   { opacity: 1; transform: translate(calc(var(--dx) * 0.08), calc(var(--dy) * 0.08 - var(--lift) * 0.5)); }
          52%  { opacity: 1; transform: translate(calc(var(--dx) * 0.52), calc(var(--dy) * 0.52 - var(--lift))); }
          86%  { opacity: 1; transform: translate(calc(var(--dx) * 0.94), calc(var(--dy) * 0.94 - var(--lift) * 0.16)); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)); }
        }
        /* The coin turning over. Edge-on it is a sliver, which is the whole
           reason to do it in scaleX rather than by swapping sprites. */
        @keyframes kioskTipFlip {
          0%   { transform: scaleX(1)    rotate(0deg);   }
          25%  { transform: scaleX(0.14) rotate(-6deg);  }
          50%  { transform: scaleX(1)    rotate(-12deg); }
          75%  { transform: scaleX(0.14) rotate(-6deg);  }
          100% { transform: scaleX(1)    rotate(0deg);   }
        }
        /* And the jar taking it: a ring of light off the mouth, gone in a
           quarter of a second. */
        @keyframes kioskTipLand {
          0%   { opacity: 0.85; transform: translate(-50%, -50%) scale(0.35); }
          100% { opacity: 0;    transform: translate(-50%, -50%) scale(1.9);  }
        }
        /* The lights going. */
        @keyframes kioskLightsOut {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        /* An apron on a hook, moving because the door opens. */
        @keyframes kioskApronSway {
          0%, 100% { transform: translateX(-50%) rotate(-1.1deg); }
          50%      { transform: translateX(-50%) rotate(1.1deg);  }
        }
        /* And breaking on the ledge: a flat splat that spreads and thins. */
        @keyframes kioskRainSplash {
          0%   { opacity: 0;    transform: scale(0.3, 1.1); }
          14%  { opacity: 0.85; transform: scale(1, 0.65);  }
          100% { opacity: 0;    transform: scale(1.7, 0.3); }
        }
        /* Standing there pleased with you, after the hop and before the duck.
           A held pose reads as the game having frozen; a sway reads as
           somebody enjoying their dinner. */
        @keyframes kioskCustomerPleased {
          0%   { transform: rotate(0deg);    }
          25%  { transform: rotate(-1.8deg); }
          75%  { transform: rotate(1.8deg);  }
          100% { transform: rotate(0deg);    }
        }
        /* The till roll printing. */
        @keyframes kioskReceiptIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
        /* The jar taking the weight of another coin. */
        @keyframes kioskJarClink {
          0%   { transform: translateY(0)    scale(1, 1);       }
          35%  { transform: translateY(1.5%) scale(1.05, 0.95); }
          70%  { transform: translateY(-1%)  scale(0.98, 1.03); }
          100% { transform: translateY(0)    scale(1, 1);       }
        }
        /* Bars behind the radio's grille. */
        @keyframes kioskRadioEq {
          from { transform: scaleY(0.25); }
          to   { transform: scaleY(1);    }
        }
        @keyframes kioskGradeIn {
          0%   { opacity: 0; transform: scale(0.5) rotate(-8deg); }
          70%  { opacity: 1; transform: scale(1.12) rotate(2deg); }
          100% { opacity: 1; transform: scale(1)   rotate(0deg);  }
        }
        @keyframes kioskBubbleIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.9); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1);   }
        }
        @keyframes kioskBubbleOut {
          from { opacity: 1; transform: translateX(-50%) scale(1);    }
          to   { opacity: 0; transform: translateX(-50%) scale(0.92); }
        }
        @keyframes kioskRefuse {
          0%, 100% { transform: translateX(0);    }
          20%      { transform: translateX(-7px); }
          45%      { transform: translateX(6px);  }
          70%      { transform: translateX(-4px); }
        }
        @keyframes kioskNudge {
          0%   { opacity: 0; transform: translateY(5px); }
          10%  { opacity: 1; transform: translateY(0);   }
          78%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes kioskFridgeIn {
          from { opacity: 0; transform: scale(1.14); }
          to   { opacity: 1; transform: scale(1);    }
        }
        @keyframes kioskLineIn {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        /* Heat off the cone. Every wisp sets its own drift, rise and peak
           opacity, so nine of them read as a haze around the meat rather than
           one column out of the top. */
        @keyframes kioskSmoke {
          0%   { opacity: 0;                        transform: translate(0, 0)                     scale(0.45); }
          13%  { opacity: var(--puff);              }
          /* Held near full for most of the rise. Fading from the first frame
             leaves every wisp but one sitting at almost nothing, and eleven
             invisible wisps look exactly like no smoke at all. */
          58%  { opacity: calc(var(--puff) * 0.74); }
          100% { opacity: 0;                        transform: translate(var(--drift), var(--lift)) scale(1.75); }
        }
        /* Only opacity + scale: the positioning and the hand-placed tilt live
           on wrappers, because a forwards-filling animation would otherwise
           overwrite whatever transform the element was given inline. */
        @keyframes kioskDropOn {
          0%   { opacity: 0; transform: scale(1.55); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: scale(1);    }
        }
        /* A slice coming off the cone: it peels away from the blade, then
           drops to the tray with the weight of a wet thing. */
        @keyframes kioskShave {
          0%   { opacity: 0; transform: translate(0, 0)          rotate(-8deg) scale(0.65); }
          14%  { opacity: 1; transform: translate(-8%, 12%)      rotate(4deg)  scale(1);    }
          100% { opacity: 0; transform: translate(-34%, 190%)    rotate(64deg) scale(0.9);  }
        }
        /* The carve gauge topping out. */
        @keyframes kioskGaugeFlash {
          0%   { transform: translateX(-50%) scale(1);    filter: brightness(2.1); }
          100% { transform: translateX(-50%) scale(1);    filter: brightness(1);   }
        }
        /* The value of a wrap, riding under the till while its coins fly. */
        @keyframes kioskEarn {
          0%   { opacity: 0; transform: translateY(-4px); }
          18%  { opacity: 1; transform: translateY(0);    }
          72%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(3px);  }
        }
        /* The handset rattling in its cradle. Two bursts inside one 1.6s
           cycle, landing on the two brrrings of kiosk_ring, with a rest
           after — a phone that buzzes continuously reads as an alarm. */
        @keyframes kioskRingShake {
          0%,  27%, 35%, 62%, 100% { transform: translateX(0)      rotate(0deg);    }
          3%,  38%                 { transform: translateX(-2.2px) rotate(-3.6deg); }
          7%,  42%                 { transform: translateX(2.4px)  rotate(3.8deg);  }
          11%, 46%                 { transform: translateX(-2px)   rotate(-3deg);   }
          15%, 50%                 { transform: translateX(2px)    rotate(3deg);    }
          19%, 54%                 { transform: translateX(-1.4px) rotate(-2deg);   }
          23%, 58%                 { transform: translateX(1.2px)  rotate(1.6deg);  }
        }
        /* Answered: the handset tips out of the cradle and stays there for as
           long as the message runs. */
        @keyframes kioskHandsetOff {
          0%   { transform: translate(0, 0)        rotate(0deg);   }
          60%  { transform: translate(-9%, 3.5%)   rotate(-19deg); }
          100% { transform: translate(-7.5%, 2.8%) rotate(-15deg); }
        }
        @keyframes kioskRingGlow {
          0%, 100% { opacity: 0.16; }
          14%      { opacity: 0.62; }
          40%      { opacity: 0.22; }
          54%      { opacity: 0.58; }
        }
        @keyframes kioskRingChip {
          0%, 100% { transform: translateY(0)    scale(1);    }
          12%      { transform: translateY(-2px) scale(1.05); }
          24%      { transform: translateY(0)    scale(1);    }
          46%      { transform: translateY(-2px) scale(1.05); }
          58%      { transform: translateY(0)    scale(1);    }
        }
        @keyframes kioskCallIn {
          from { opacity: 0; transform: translateY(-7px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes kioskCaret {
          0%, 49%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes kioskRollShut {
          0%   { transform: scaleX(1)    scaleY(1);    }
          45%  { transform: scaleX(0.55) scaleY(1.06); }
          100% { transform: scaleX(1)    scaleY(1);    }
        }
`
