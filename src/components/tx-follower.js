export default class txFollower {
	constructor(hash, scene) {
		this.scene = scene;
		this.hash = hash;
        this.entry = this.scene.lineManager[this.hash];
        this.bus = false;
        this.boarded = false;
        this.findEvent = false;
        this.focused = false;
	}

	start() {
        this.find();
        if ("Notification" in window) window.Notification.requestPermission();
	}

	stop() {
        this.unFollowPerson();
        this.unfollowBus();
    }

    pause(){
        let previousFocus = this.focused;
        let previousBus = this.bus;
        let previousBoarded = this.boarded;
        this.stop();
        this.focused = previousFocus;
        this.bus = previousBus;
        this.boarded = previousBoarded;
    }
    
    find(){
        if(!this || !this.scene || !this.scene.lineManager[this.hash]){
            this.stop();
            return false;
        }
        let person = this.scene.getPersonFromHash(this.hash);
        let bus = this.scene.getBusFromId(this.scene.lineManager[this.hash].boarded);
		if (person) {
			this.followPerson(person);
		} else if (bus) {
			this.followBus(bus);
        }
        else{
            if(this.findEvent) clearTimeout(this.findEvent);
            this.findEvent = setTimeout(() => {
                if(!this) return false;
                this.find();
            }, 1000);
        }
    }

    focus(){
        if(!this || !this.scene || !this.scene.lineManager[this.hash]){
            this.stop();
            return false;
        }
        this.focused = true;
        this.scene.vue.$refs.following.focusedTx = this.hash;
        let person = this.scene.getPersonFromHash(this.hash);
        let bus = this.scene.getBusFromId(this.scene.lineManager[this.hash].boarded);
		if (person) {
			this.focusPerson(person);
		} else if (bus) {
			this.focusBus(bus);
        }
    }

	followBus(bus) {
        this.bus = bus;
        this.boarded = (this.scene.lineManager[this.hash] ? this.scene.lineManager[this.hash].boarded : false);
        this.highlightBus(bus);
        if(this.focused) this.focusBus(bus);
		this.scene.events.on("preupdate", this.followListener = () => {
            let boarded = (this.scene.lineManager[this.hash] ? this.scene.lineManager[this.hash].boarded : false);
			if (!boarded || boarded !== this.boarded) {
                this.unfollowBus(false);
                this.find();
				return false;
            }
            
            if(!this.focused || !this.follow) return false;
			let change = this.followScroll - this.follow._scrollY;
			this.followScroll = this.follow._scrollY;
			let toScroll = this.follow._scrollY;
			if (change !== 0) {
				//check if they are entering bus, and then exit and follow bus
				this.scene.scrollTileSprites(toScroll, true);
			}
		});
    }

    focusBus(bus){
        this.follow = this.scene.cameras.main.startFollow(bus);
        this.followScroll = this.follow._scrollY;
        this.scene.scrollTileSprites(this.followScroll , true);
    }
    
    unfollowBus(unfocus = true) {
		this.unhighlightBus();
        this.unfollow(unfocus);
        this.bus = false;
        this.boarded = false;
	}


	followPerson(person) {
		this.highlightPerson(person);
		if(this.focused) this.focusPerson(person);
		this.scene.events.on("preupdate", this.followListener = () => {
			let personExists = (this.scene.lineManager[this.hash] ? this.scene.lineManager[this.hash].person : false);
			if (!personExists) {
                this.unFollowPerson(false);
                this.find();
				return false;
			}

            if(!this.focused || !this.follow) return false;
			let change = this.followScroll - this.follow._scrollY;
			this.followScroll = this.follow._scrollY;
			let toScroll = this.follow._scrollY;
			if (change !== 0) {
				//check if they are entering bus, and then exit and follow bus
				if (person.moveList && person.moveList[0] && !isNaN(person.moveList[0].stepY)) {
					toScroll += person.moveList[0].stepY;
				}
				this.scene.scrollTileSprites(toScroll, true);
				this.scene.checkView();
			}
		});
    }
    
    focusPerson(person){
        this.follow = this.scene.cameras.main.startFollow(person);
        this.followScroll = this.follow._scrollY;
        this.scene.scrollTileSprites(this.followScroll , true);
    }

	unFollowPerson(unfocus = true) {
		this.unhighlightPerson();
		this.unfollow(unfocus);
    }
    
    unfollow(unfocus = true){
        if (this.followListener) {
            this.scene.events.off("preupdate", this.followListener);
            this.followListener = null;
		}
        if(this.focused && unfocus) this.unfocus();
    }

    unfocus(){
        this.focused = false;
        if(this.scene.vue.$refs.following.focusedTx === this.hash) this.scene.vue.$refs.following.focusedTx = false;
        this.scene.cameras.main.stopFollow();
        this.follow = null;
        this.scene.cameras.main.setScroll(0, this.scene.cameras.main.scrollY);
    }

	highlightBus(bus) {
        window.txStreetPhaser.streetController.addToRainbow(bus, this.entry.txData.tx);
    }
    
    unhighlightBus(){
        if(!this.bus) return false;
        window.txStreetPhaser.streetController.removeFromRainbow(this.bus, this.entry.txData.tx);
    }

	highlightPerson(person) {
        person.setDepth(this.scene.personDepth + 2);
        window.txStreetPhaser.streetController.addToRainbow(person);
	}

	unhighlightPerson() {
        //remove tweens to remove fade ins
        let person = this.scene.getPersonFromHash(this.hash);
		if (person) {
			person.setDepth(this.scene.personDepth);
            window.txStreetPhaser.streetController.removeFromRainbow(person);
		}
	}
}
