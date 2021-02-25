var planets = [];
var objects = [];
var ships = [];
var sun;
document.oncontextmenu = () => false;
var easycam
var G
var State
var secondsSinceEpoch
var ReferenceBody

var currentTime

// GUI variables
var gui
var showVessels = true
var showPlanets = true
var showObjects = false
var currOrbiterMap
var currOrbiterMapStatic

//3D model variables
var rocketModel

//Texture variables
var textureMap = new Map()

// graphics buffers
var pg

function preload() {
    // Load in current server state
    let url = 'https://larrysteele.space:8900/http://gregswebserver.com:8900'
    State = loadJSON(url)

    // Load in textures
    texture_skybox = loadImage('textures/sky_cyl_31.jpg')
    texture_sun = loadImage('textures/error.jpg')
    texture_kerbin = loadImage('textures/kerbin.jpg')
    texture_mun = loadImage('textures/mun.jpg')
    texture_minmus = loadImage('textures/minmus.jpg')
    texture_moho = loadImage('textures/moho.jpg')
    texture_eve = loadImage('textures/error.jpg')
    texture_duna = loadImage('textures/duna.png')
    texture_ike = loadImage('textures/ike.png')
    texture_jool = loadImage('textures/jool.jpg')
    texture_laythe = loadImage('textures/error.jpg')
    texture_vall = loadImage('textures/vall.png')
    texture_bop = loadImage('textures/bop.png')
    texture_tylo = loadImage('textures/tylo.png')
    texture_gilly = loadImage('textures/gilly.png')
    texture_pol = loadImage('textures/pol.png')
    texture_dres = loadImage('textures/dres.png')
    texture_eeloo = loadImage('textures/eeloo.jpg')

    // Load in 3D models
    rocketModel = loadModel('rock.obj', true)

}

function setup() {
    createCanvas(windowWidth, windowHeight,WEBGL);
    pg = createGraphics(windowWidth, windowHeight, WEBGL);

    setAttributes('antialias', true);
    easycam = createEasyCam({distance:300});
    easycam.setRotationConstraint(true, true, false)
    //easycam.setDistanceMax(100000000) // Need this so no one exits our sphere that we are putting our skybox on.
    perspective(PI/3, windowWidth/windowHeight, 1, 100000000000000000) // 10x the size of sphere just to make sure everything is in the frustrum
    frameRate(20);
    secondsSinceEpoch = State[0].CurrentState.Subspaces[0].Time
    angleMode(DEGREES)
    G = 6.67430*pow(10,-11)
    createPlanets()
    ReferenceBody = sun
    tmp = new Date( State[0].CurrentState.StartTime)
    now = new Date()
    currentTime = abs(now.getTime() - tmp.getTime())/1000 + secondsSinceEpoch + (5*3600)
    createShipsAndObjects()
    initGUI()
    // and on the seventh day...
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    //ReferenceBody.x = 0;
    //ReferenceBody.y = 0;
}

function draw() {
    //background(0, 10, 40);
    push()
    ReferenceBody.display()
    pop()
    //lightFalloff(0,0,(4*PI)/10000000) //This would be physically-ish correct, save finding the correct power term, but produces poor results
    lightFalloff(.3,.001,0) // I need to find a better setup for this. Also my planets produce light when they are the reference body
    pointLight(255,255,255,0,0,0)
    //debugMode()
    push()
        rotateX(90)
        ambientLight(255,255,255)
        texture(texture_skybox)
        sphere(10000000000000000)
    pop()
    ambientLight(25,25,25)
    if (showPlanets) { 
        plotOrbits(ReferenceBody.orbiters)
    }
    if (showVessels) { plotOrbits(ReferenceBody.ships) }
    if (showObjects) { plotOrbits(ReferenceBody.objects) }

}

class Orbiter {
    constructor(a, e, i, aop, loan, ma, epoch, real_max, radius, mu, mass, parent, name, type, scaling) {
        this.a = a
        this.e = e
        this.i = i
        this.aop = aop
        this.loan = loan
        this.ma = ma
        this.epoch = epoch
        this.real_max = real_max
        this.radius = radius
        this.mu = mu
        this.mass = mass
        this.parent = parent
        this.name = name
        this.type = type
        this.scaling = scaling // I really spent like 4 hours trying to use the existing conversion factors to do essentially this, but I couldn't get a good solution

        this.orbiters = []
        this.orbitersMap = []
        this.ships = []
        this.shipsMap = []
        this.objects = []
        this.objectsMap = []

        this.r = 100
        this.g = 100
        this.b = 100
    }
    
    approx_EA() {
        let E0
        let E1
        E0 = this.MA + this.e*(180/PI)*sin(this.MA) * (1 + this.e * cos(this.MA))
        E1 = E0 - (E0 - this.e*(180/PI)*sin(E0) - this.MA) / (1 - this.e*cos(E0))
        while (abs(E1-E0)>.00005) {
            E0 = E1
            E1 = E0 - (E0 - this.e*(180/PI)*sin(E0) - this.MA) / (1 - this.e*cos(E0))
        }
        this.EA = E1
    }

    convert() {
        if (this.parent == -1) {
            this.conv = (windowWidth)/(this.real_max)
        }
        else {
           this.conv = (windowWidth)/(ReferenceBody.real_max)
        }

        this.ellx = 0
        this.elly = 0
        this.width = this.a*this.conv*2
        this.height = (this.a*sqrt(1-pow(this.e,2)))*this.conv*2
    }

    display() {
        stroke(this.r,this.g,this.b);
        strokeWeight(1)
        noFill()
        this.convert()
        if (this.width == 0 || ReferenceBody == this) {
            //fill(200,150,50)
            noStroke()
            rotateX(-90)
            if (this.type == "planet" || this.type == "sun") {
                texture(textureMap.get(this.name))
            }
            else {
                texture(texture_kerbin)
            }
            //We need the conversion term here though because central bodies can have vessels on their
            //surface, so the radius needs to be scaled correctly such that objects on surface will render
            //correctly in this visualizer, also to make sure no low orbits are obscured.
            sphere(this.radius*this.conv)
            return
            
        }
        return ellipse(this.ellx, this.elly, this.width, this.height, 50);
    }

    display3d() {
        fill(this.r,this.g,this.b)
        noStroke()
        if (this.parent != -1 || ReferenceBody != this) {
            if (this.mass == 0){
                this.T = 2*PI*sqrt(pow(this.a,3)/(G*this.parent.mass))
            }
            else {
                this.T = 2*PI*sqrt(pow(this.a,3)/(G*(this.parent.mass+this.mass)))
            }
            //If a ship/comet/debris/object
            if (this.mass == 0) {
                this.MA = degrees(this.ma)
            }
            else {
                this.MA = degrees(this.ma) + (360/this.T)*(currentTime-0)
            }
            this.approx_EA() //sets value of this.EA
            this.nu = -2*atan2(sqrt(1-this.e)*cos(this.EA/2), sqrt(1+this.e)*sin(this.EA/2))
            this.r = this.a*(1-this.e*cos(this.EA))
            this.h = sqrt(this.mu*this.a*(1-pow(this.e,2)))

            //We switch X and Y here because we want to apply a rotation, and p5js is weird with those but this works too
            // Honestly idk why the z is fipped, probably because we naively flipped x and y after the fact
            this.y = this.r*((cos(this.loan)*cos(this.aop+this.nu)) - sin(this.loan)*sin(this.aop+this.nu)*cos(this.i))
            this.x = this.r*((sin(this.loan)*cos(this.aop+this.nu)) + cos(this.loan)*sin(this.aop+this.nu)*cos(this.i))
            this.z = -this.r*(sin(this.i)*sin(this.aop+this.nu))
            translate(this.x*this.conv,this.y*this.conv,this.z*this.conv)
        }
        /* I've changed this size term a lot of times, its given me a lot of grief. The correct way is simply the same way we draw
            the reference bodies, (radius*conv) but this leaves nearly every planet invisible especially in the Kerbol scene, as the
            planets are simply too small. KSP gets around this by simply putting a map marker over the planet when it itself is not
            visible, but that sounded kinda lame tbh. However, a simple multiple will make smaller systems like Kerbin completely borked
            with massive moons.
            
            Another issue is that some orbiters are simply dwarfed by their neighbors, like Eeloo compared to Jool, a visible Jool often
            means a pinpoint sized Eeloo, so a square root function was chosen rather arbitrarily to try and maintain some of the size
            difference, while allowing all small bodies to be visible.
            
            The scaling factor is ugly, but I'll be honest, I really tried, you should have seen some of the cursed functions I was creating.
            The ones that came closest to working were taking the radius to a power much closer to zero, so while all the planets fit into each
            scene, their relative sizes were lost, ugly to see a Moho the size of Jool.*/

        let size = this.parent.scaling*pow(this.radius,.5)*pow(this.conv,1)
        //if (size < 3) { size = 3 }
        //scale(0.2)
        normalMaterial()
        //push()
        rotateX(-90)
        rotateY(frameCount*.5)
        if (this.type == "planet" || this.type == "sun") {
            texture(textureMap.get(this.name))
        }
        else {
            texture(texture_kerbin)
        }
        //texture(texture_duna)
        sphere(size)
        return
    }
}

function initGUI() {
    gui = createGui("Reference Body: " + ReferenceBody.name)
    currOrbiterMap = ReferenceBody.orbitersMap
    currOrbiterMapStatic = ReferenceBody.orbitersMap
    gui.addGlobals('currOrbiterMap')
    gui.addButton("Go to Selected Body", function() {
        if (ReferenceBody.orbiters.length >= 1) {
            ReferenceBody = ReferenceBody.orbiters[currOrbiterMapStatic.indexOf(currOrbiterMap)]
            currOrbiterMap = ReferenceBody.orbitersMap
            currOrbiterMapStatic = ReferenceBody.orbitersMap
            initGUI()
        }
    })
    gui.addButton("Go to Parent Body", function() {
        if (ReferenceBody.parent != -1) {
            ReferenceBody = ReferenceBody.parent
            currOrbiterMap = ReferenceBody.orbitersMap
            currOrbiterMapStatic = ReferenceBody.orbitersMap
            initGUI()
        }
    })
    gui.addButton("Show/Hide Vessels", function() {
        showVessels = !showVessels
    })
    gui.addButton("Show/Hide Planets", function() {
        showPlanets = !showPlanets
    })
    gui.addButton("Show/Hide Asteroids/Comets", function() {
        showObjects = !showObjects
    })
}

function plotOrbits(orbiters) {
    for (var orbiter of orbiters) {
        push()
        angleMode(DEGREES)
        rotateZ(90)
        rotateZ(-orbiter.loan)
        rotateX(orbiter.i)
        rotateZ(-orbiter.aop)
        translate(orbiter.a*orbiter.e*orbiter.conv,0,0)
        if (orbiter.mass == 0) {
            orbiter.r = 0
            orbiter.g = 0
            orbiter.b = 255 
        }
        orbiter.display();
        pop()
        if (this.parent != -1) {
            push()
            angleMode(DEGREES)
            if (orbiter.mass == 0) {
                orbiter.r = 0
                orbiter.g = 255
                orbiter.b = 0 
            }
            orbiter.display3d();
            pop()
        }
    }
}

function createPlanets() {
    sun = new Orbiter(0,0,0,0,0,0,0,150*pow(10,9),261600000,0, 1.757*pow(10,28), -1, "Kerbol", "sun", 1500000);
    //sun = new Orbiter(0,0,0,0,0,0,0,90118820000,261600000,0, 1.757*pow(10,28), -1, "Kerbol", "sun");
    
    kerbin = new Orbiter(13599840256, 0, 0, 0, 0, 3.14, 0, 84159286, 600000, 3.53*pow(10,12), 5.292*pow(10,22), sun, "kerbin", "planet", 2000)
    mun = new Orbiter(12000000, 0, 0, 0, 0, 1.7, 0, 2429559.1, 200000, 6.51*pow(10,10), 9.760*pow(10,20), kerbin, "mun", "planet", 1)
    minmus = new Orbiter(47000000, 0, 6, 38, 78, 0.9, 0, 2247428.4, 60000, 1.77*pow(10,9), 2.646*pow(10,19), kerbin, "minmus", "planet", 1)
    moho = new Orbiter(5263138304, 0.2, 7, 15, 70, 3.14, 0, 9646663, 250000, 2.45*pow(10,11), 2.526*pow(10,21), sun, "moho", "planet", 1)
    eve = new Orbiter(9832684544, 0.01, 2.1, 0, 15, 3.14, 0, 85109365, 700000, 8.17*pow(10,12), 1.224*pow(10,23), sun, "eve", "planet", 2000)
    duna = new Orbiter(20726155264, 0.051, 0.06, 0, 135.5, 3.14, 0, 47921949, 320000, 3.01*pow(10,11), 4.515*pow(10,21), sun, "duna", "planet", 250)
    ike = new Orbiter(3200000, 0.03, 0.2, 0, 0, 1.7, 0, 1049598.9, 130000, 1.86*pow(10,10), 2.782*pow(10,20), duna, "ike", "planet", 1)
    jool = new Orbiter(68773560320, 0.05, 1.304, 0, 52, 0.1, 0, 2.456*pow(10,9), 6000000, 2.83*pow(10,14), 4.233*pow(10,24), sun, "jool", "planet", 4000)
    laythe = new Orbiter(27184000, 0, 0, 0, 0, 3.14, 0, 3723645.8, 500000, 1.96*pow(10,12), 2.940*pow(10,22), jool, "laythe", "planet", 1)
    vall = new Orbiter(43152000, 0, 0, 0, 0, 0.9, 0, 2406401.4, 300000, 2.07*pow(10,11), 3.109*pow(10,21), jool, "vall", "planet", 1)
    bop = new Orbiter(128500000, 0.235, 15, 25, 10, 0.9, 0, 1221060.9, 65000, 2.49*pow(10,9), 3.726*pow(10,19), jool, "bop", "planet", 1)
    tylo = new Orbiter(68500000, 0, 0.025, 0, 0, 3.14, 0, 10856518, 600000, 2.83*pow(10,12), 4.233*pow(10,22), jool, "tylo", "planet", 1)
    gilly = new Orbiter(31500000, 0.55, 12, 10, 80, 0.9, 0, 126123.27, 13000, 8.29*pow(10,6), 1.242*pow(10,17), eve, "gilly", "planet", 1)
    pol = new Orbiter(179890000, 0.171, 4.25, 15, 2, 0.9, 0, 1042138.9, 44000, 7.22*pow(10,8), 1.081*pow(10,19), jool, "pol", "planet", 1)
    dres = new Orbiter(40839348203, 0.145, 5, 90, 280, 3.14, 0, 32832840, 138000, 2.15*pow(10,10), 3.219*pow(10,20), sun, "dres", "planet", 1)
    eeloo = new Orbiter(90118820000, 0.26, 6.15, 260, 50, 3.14, 0, 1.191*pow(10,8), 210000, 7.44*pow(10,10), 1.115*pow(10,21), sun, "eeloo", "planet", 1)

    planets[0] = sun
    planets[1] = kerbin
    planets[2] = mun
    planets[3] = minmus
    planets[4] = moho
    planets[5] = eve
    planets[6] = duna
    planets[7] = ike
    planets[8] = jool
    planets[9] = laythe
    planets[10] = vall
    planets[11] = bop
    planets[12] = tylo
    planets[13] = gilly
    planets[14] = pol
    planets[15] = dres
    planets[16] = eeloo
    
    textureMap.set(sun.name, texture_sun)
    textureMap.set(kerbin.name, texture_kerbin)
    textureMap.set(mun.name, texture_mun)
    textureMap.set(minmus.name, texture_minmus)
    textureMap.set(moho.name, texture_moho)
    textureMap.set(eve.name, texture_eve)
    textureMap.set(duna.name, texture_duna)
    textureMap.set(ike.name, texture_ike)
    textureMap.set(jool.name, texture_jool)
    textureMap.set(laythe.name, texture_laythe)
    textureMap.set(vall.name, texture_vall)
    textureMap.set(bop.name, texture_bop)
    textureMap.set(tylo.name, texture_tylo)
    textureMap.set(gilly.name, texture_gilly)
    textureMap.set(pol.name, texture_pol)
    textureMap.set(dres.name, texture_dres)
    textureMap.set(eeloo.name, texture_eeloo)

    for (var p of planets) {
        //console.log(p)
        if (p.parent != -1) {
            //console.log(p.parent.name)
            p.parent.orbiters[p.parent.orbiters.length] = p
            p.parent.orbitersMap[p.parent.orbitersMap.length] = p.name
        }
    }
}

function createShipsAndObjects() {
    objects = []
    ships = []
    for (v of State[0].CurrentState.CurrentVessels) {
        if (v.Type == "SpaceObject") {
            objects[objects.length] = new Orbiter(v.SemiMajorAxis,v.Eccentricity,v.Inclination,v.ArgumentOfPeriapsis,v.LongitudeOfAscendingNode,v.MeanAnomaly, v.epoch, 0, 0, 0, 0, planets[v.ReferenceBody], v.Name, v.Type)
        }
        else {
            ships[ships.length] = new Orbiter(v.SemiMajorAxis,v.Eccentricity,v.Inclination,v.ArgumentOfPeriapsis,v.LongitudeOfAscendingNode,v.MeanAnomaly, 0, 0, 0, 0, 0, planets[v.ReferenceBody], v.Name, v.Type)
            //ships[ships.length] = new Orbiter(v.SemiMajorAxis,v.Eccentricity,v.Inclination,v.ArgumentOfPeriapsis,v.LongitudeOfAscendingNode,v.MeanAnomaly, v.Epoch, 0, 0, 0, 0, planets[v.ReferenceBody], v.Name)
        }
    }

    for (let s of ships) {
        if (s.parent != -1) {
            s.parent.ships[s.parent.ships.length] = s
        }
    }
    for (let s of objects) {
        if (s.parent != -1) {
            s.parent.objects[s.parent.objects.length] = s
        }
    }
}

function mapTextures() {
    
    for (p of planets) {
        textureMap.set(p.name, texture_duna)
    }
}